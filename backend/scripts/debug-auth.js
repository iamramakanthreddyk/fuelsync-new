const { sequelize, User } = require('../src/models');

const run = async () => {
  try {
    console.log('Syncing DB (force:true)...');
    await sequelize.sync({ force: true });

    console.log('Creating user admin@test.com with password admin123');
    const admin = await User.create({
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Debug Admin',
      role: 'super_admin',
      isActive: true
    });

    console.log('User created:', { id: admin.id, email: admin.email });

    const found = await User.findOne({ where: { email: 'admin@test.com', isActive: true } });
    console.log('Found user:', !!found);

    const match = await found.comparePassword('admin123');
    console.log('Password match for admin123:', match);

    const wrong = await found.comparePassword('wrongpassword');
    console.log('Password match for wrongpassword:', wrong);

    await sequelize.close();
  } catch (err) {
    console.error('Debug error:', err);
    process.exit(1);
  }
};

run();
