/**
 * Test admin login functionality
 */
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function testAdminLogin() {
  try {
    console.log('🧪 Testing Admin Login...\n');

    // Find admin user
    const admin = await User.findOne({ where: { email: 'admin@fuelsync.com' } });
    
    if (!admin) {
      console.error('❌ Admin user not found in database!');
      process.exit(1);
    }

    console.log('✅ Admin user found:');
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.name);
    console.log('   Role:', admin.role);
    console.log('   Password hash:', admin.password.substring(0, 30) + '...');
    console.log('   Hash length:', admin.password.length);
    console.log('');

    // Test password comparison
    const testPassword = 'admin123';
    console.log('🔐 Testing password:', testPassword);
    
    // Method 1: Using model's comparePassword method
    const isMatchMethod = await admin.comparePassword(testPassword);
    console.log('   comparePassword method:', isMatchMethod ? '✅ MATCH' : '❌ NO MATCH');

    // Method 2: Direct bcrypt compare
    const isMatchDirect = await bcrypt.compare(testPassword, admin.password);
    console.log('   bcrypt.compare direct:', isMatchDirect ? '✅ MATCH' : '❌ NO MATCH');

    // Test with wrong password
    const wrongPassword = 'wrongpassword';
    const isWrongMatch = await admin.comparePassword(wrongPassword);
    console.log('   Wrong password test:', isWrongMatch ? '❌ SHOULD NOT MATCH' : '✅ Correctly rejected');

    console.log('\n' + '='.repeat(50));
    if (isMatchMethod && isMatchDirect) {
      console.log('✅ ADMIN LOGIN TEST PASSED');
      console.log('   Credentials: admin@fuelsync.com / admin123');
    } else {
      console.log('❌ ADMIN LOGIN TEST FAILED');
      console.log('   Password hashing issue detected!');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testAdminLogin();
