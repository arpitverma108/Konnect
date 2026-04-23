 const { exec } = require("child_process");


const HT_PASSWD_PATH = "/home/arihant/svn-config/htpasswd";


// 🔐 Create SVN user

function createSvnUser(username, password) {

return new Promise((resolve, reject) => {


// basic sanitization (important)

const safeUsername = username.replace(/[^a-zA-Z0-9]/g, '');


const cmd = `htpasswd -b ${HT_PASSWD_PATH} ${safeUsername} ${password}`;


exec(cmd, (error, stdout, stderr) => {

if (error) {

console.error("SVN ERROR:", stderr);

return reject(error);

}

resolve(stdout);

});

});

}


module.exports = { createSvnUser }; 