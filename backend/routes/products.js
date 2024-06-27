const express = require('express');
const router = express.Router();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')
const { format } = require('util');

module.exports = (db, upload, bucket) => {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

  function verifyAdminToken(req, res, next) {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Token not provided' });
    }

    try {
      const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET_KEY);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Not an admin' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  router.use(express.json());
  //login as admin , send password and name which will be checked againt the stored hash
  //for response , you'll get an authorization token

  router.post('/enter', async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME) {
      const validPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (validPassword) {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token });
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  });


  router.use(bodyParser.json());
  //if you are admin and token has been verified you can add products to db

  router.post('/add-product', verifyAdminToken, upload.single('image'), async (req, res) => {
    const { name, price, description, quantity } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const blob = bucket.file(Date.now() + path.extname(req.file.originalname));
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype
      }
    });

    blobStream.on('error', (err) => {
      console.error('Error uploading to Firebase Storage:', err);
      res.status(500).json({ error: 'Failed to upload image' });
    });

    blobStream.on('finish', async () => {
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
      
      try {
        const newProduct = { name, price, description, quantity, imageUrl: publicUrl };
        await db.collection('products').add(newProduct);
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
      } catch (error) {
        console.error('Error adding product to Firestore:', error);
        res.status(500).json({ error: 'Failed to add product' });
      }
    });

    blobStream.end(req.file.buffer);
  });

// Route to edit a product (PUT /products/:productId) if you are an admin
router.put('/:productId', verifyAdminToken, upload.single('image'), async (req, res) => {
  const { name, price, description, quantity } = req.body;
  const { productId } = req.params;

  try {
    const productRef = db.collection('products').doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let imageUrl = productDoc.data().imageUrl; // Use existing image URL by default

    if (req.file) {
      // If a new image file is provided, upload it and update imageUrl
      const blob = bucket.file(Date.now() + path.extname(req.file.originalname));
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype
        }
      });

      blobStream.on('error', (err) => {
        console.error('Error uploading to Firebase Storage:', err);
        res.status(500).json({ error: 'Failed to upload image' });
      });

      blobStream.on('finish', async () => {
        imageUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
        await productRef.update({ name, price, description, quantity, imageUrl });
        res.json({ message: 'Product updated successfully' });
      });

      blobStream.end(req.file.buffer);
    } else {
      // If no new image file is provided, update other fields only
      await productRef.update({ name, price, description, quantity });
      res.json({ message: 'Product updated successfully' });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

  //fetch  all products from db

  router.get('/', async (req, res) => {
    try {
      const productsSnapshot = await db.collection('products').get();
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });
  
  //fetch specific product from db

  router.get('/:productId', async(req, res) => {
    try {
      const { productId } = req.params;
      const productRef = db.collection('products').doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) {
        return res.status(404).send('Product not found');
      }
      const productData = productDoc.data();
      res.json(productData);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });

//if you are admin and have a valid token you can delete products from db
  router.delete('/:productId', verifyAdminToken, async(req, res) => {
    try {
      const { productId } = req.params;
      const productRef = db.collection('products').doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) {
        return res.status(404).send('Product not found');
      }
      await productRef.delete();
      res.status(200).send('Product deleted successfully');
    } catch (error) {
      console.error('Failed to delete product:', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  return router;
};
