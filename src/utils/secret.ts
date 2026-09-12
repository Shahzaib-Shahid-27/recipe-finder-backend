import crypto from 'crypto';

function generateSecret(length = 36) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('Access Token Secret:', generateSecret());
console.log('Refresh Token Secret:', generateSecret());

export default { generateSecret };