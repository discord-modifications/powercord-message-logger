const fs = require('fs');

module.exports = (() => {
   let files = {};

   fs.readdirSync(__dirname).filter(file => file !== 'index.js').map(fn => {
      return files[fn.replace('.js', '').replace('.jsx', '')] = require(`${__dirname}/${fn}`);
   });

   return files;
})();