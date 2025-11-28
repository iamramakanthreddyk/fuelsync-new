const bcrypt = require('bcrypt');

const resetAdminPassword = async () => {
  try {
    console.log('🔐 Resetting admin password...');

    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
console.log('🔑 New password hashed successfully!', hashedPassword) ;
    console.log('✅ Admin password reset successfully!');
  } catch (error) {
    console.error('❌ Failed to reset password:', error.message);
  }
};

resetAdminPassword();
