const express = require('express')
const app = express.Router()
const path = require('path');

module.exports = (db) =>{

  //middleware to fetch auto generated user id 

app.use((req, res, next)=>{const userID = req.headers['user-id'];
if(!userID){
  return res.status(400).send('user ID is required');

}
req.userID = userID
next()
});


//route to fetch cart items 

app.get('/', async(req, res)=>{
  const cartRef = db.collection('carts').doc(req.userID)
  const doc = await cartRef.get();

  if (!doc.exists){
    return res.status(404).send('cart not found');
  }
  res.json(doc.data())
})

//route to add or update cart items 

app.post('/', async(req, res)=> {
  const { items } = req.body;
  if (!Array.isArray(items) || items.some(item => !item.productId)) {
    return res.status(400).send('Invalid cart items');
  }

  const cartRef = db.collection('carts').doc(req.userID)
  await cartRef.set({items}, {merge: true});
  res.send('cart updated')
});

//route to delete cart items 

app.delete('/:productId', async(req, res)=>{
  try{

  const { productId } = req.params;
  const cartRef = db.collection('carts').doc(req.userID)
  const doc = await cartRef.get()
  if(!doc.exists)
    {
      return res.status(404).json({message:'cart not found'});
    }

    const cartData = doc.data();
    const updatedItems = cartData.items.filter(item => item.productId !== productId);
    await cartRef.set({items: updatedItems}, {merge: true})
    res.json({message:'item removed'})}

    catch(error){
      console.error('Error deleting cart', error)
      res.status(500).json({error: 'cart not found'})
    }
});
return app;

}