const axios = require('axios');
const fs = require('fs');

(async () => {
    try {
        const response = await axios.get('https://www.thestar.com.my/business/marketwatch/');
        fs.writeFileSync('star.html', response.data);
        console.log('Saved star.html');
    } catch (e) {
        console.error(e.message);
    }
})();
