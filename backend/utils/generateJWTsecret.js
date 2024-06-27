
const crypto = require('crypto');


const JWT_SECRET_KEY = crypto.randomBytes(32).toString('hex');
console.log('Generated JWT Secret Key:', JWT_SECRET_KEY);
