import apexjs from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

export default apexjs(async (event, context) => {
  console.log({event, context});
});
