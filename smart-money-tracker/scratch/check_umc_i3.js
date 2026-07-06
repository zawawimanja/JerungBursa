const axios = require('axios');

axios.get('https://klse.i3investor.com/web/market/mostactive')
    .then(res => {
        const html = res.data;
        const index = html.indexOf('0256');
        if (index !== -1) {
            console.log(html.substring(index - 200, index + 200));
        } else {
            console.log('0256 not found');
        }
    })
    .catch(err => console.error(err));
