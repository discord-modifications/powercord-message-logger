const { React } = require('powercord/webpack');

module.exports = () => {
   const setValue = React.useState(0)[1];
   return () => setValue(v => ~v);
};