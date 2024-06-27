const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');

dotenv.config();

const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH;
if (!serviceAccountPath) {
  throw new Error("Missing SERVICE_ACCOUNT_KEY_PATH environment variable");
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const app = express();
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  console.log("I am up and running");
  res.send("Server is up and running");
});

const productRouter = require("./routes/products")(db, upload, bucket); // Ensure correct path and arguments
const cartRouter = require("./routes/cart")(db);
const adminRouter = require("./routes/admin")(db, upload, bucket);

app.use("/cart", cartRouter);
app.use("/products", productRouter); 
app.use("/admin", adminRouter)

const PORT = process.env.PORT || 61361;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
});
