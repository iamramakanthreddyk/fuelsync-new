const {Sequelize} = require('sequelize');
const sq = new Sequelize({dialect:'sqlite',storage:'./database.sqlite',logging:false});

(async()=>{
  const [r]=await sq.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', r.map(t=>t.name).join(', '));
  await sq.close();
})();
