/**
 * Check actual pump table schema
 */
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'data/fuelsync.db'),
  logging: false
});

(async () => {
  try {
    // Check indexes
    console.log('=== PUMP TABLE INDEXES ===');
    const indexes = await sequelize.query(
      `PRAGMA INDEX_LIST(pumps)`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    indexes.forEach(idx => {
      console.log(`\nIndex: ${idx.name}`);
      console.log(`  Unique: ${idx.unique}`);
      console.log(`  Partial: ${idx.partial}`);
    });

    // Get index info
    console.log('\n=== INDEX DETAILS ===');
    for (const idx of indexes) {
      const details = await sequelize.query(
        `PRAGMA INDEX_INFO(${idx.name})`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      console.log(`\n${idx.name}:`);
      details.forEach(d => {
        console.log(`  ${d.name}`);
      });
    }

    // Check for UNIQUE constraint on station_id alone
    console.log('\n=== CHECKING FOR BAD CONSTRAINTS ===');
    const constraints = await sequelize.query(
      `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='pumps'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log('\nAll pump indexes (SQL):');
    constraints.forEach(c => {
      console.log(`  ${c.sql || 'PRIMARY KEY or UNIQUE constraint'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
