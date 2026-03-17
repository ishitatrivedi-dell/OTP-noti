function generateSixDigitOtp() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

function otpExpiryDate(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateSixDigitOtp, otpExpiryDate };

