const express = require('express');
const session = require('express-session');
const { redirect } = require('express/lib/response');
const logic = require('./logic.js');
const app = express();
const port = 3000;


// setup views and static files
app.set('view engine', 'ejs');
app.use(express.static('static'));
app.use(express.urlencoded({extended: true})); // req.body
app.use(session({secret: 'secret', resave: true, saveUninitialized: true}));


// connect database
const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('db/retro.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('database connected.');
});





// render systems search
app.get('/systems', async (req, res) => {
    req.session.filter = null;
    if (req.session.loggedin == true) {
        let user = req.session.user;
        let sys = req.query.sys;
        let in_fav = await logic.db_all('SELECT * FROM fav_systems WHERE (sys_name == \'' + sys + '\' and UID == \'' + user + '\')', db);
        if (sys && in_fav.length == 0) {
            await db_run('INSERT INTO fav_systems VALUES (\'' + sys + '\', \'' + user + '\');');
        }

        let tables = await logic.systemSearch(req.query, db, req.session.user);
        res.render('pages/sSearch', {rows: tables[0], favs: tables[1]});
    } else {
        res.redirect('/');
    }
});

// render games search
app.get('/games', async (req, res) => {
    if (req.session.loggedin == true) {
        let user = req.session.user;
        let GID = req.query.GID;
        let in_fav = await logic.db_all('SELECT * FROM fav_games WHERE (GID == \'' + GID + '\' and UID == \'' + user + '\')', db);
        if (GID && in_fav.length == 0) {
            await db_run('INSERT INTO fav_games VALUES (\'' + GID + '\', \'' + user + '\');');
        }

        let tables = await logic.gameSearch(req.query, db, req.session.user);
        res.render('pages/gSearch', {rows: tables[0], favs: tables[1]});
    } else {
        res.redirect('/');
    }
});





// render system page
app.get('/system', async (req, res) => {
    if (req.session.loggedin == true) {
        let name = req.query.name;
        let sql = 'SELECT * FROM systems WHERE (name == \'' + name + '\')';
        let system = await logic.db_all(sql, db);
        res.render('pages/system', {sys: system});
    } else {
        res.redirect('/');
    }
});

// render game page
app.get('/game', async (req, res) => {
    if (req.session.loggedin == true) {
        let GID = req.query.GID;
        let sql = 'SELECT GID, title, publisher, year, sys_name, contributor, manual, cover, disk FROM games JOIN system_games on (games.ID == system_games.GID) WHERE (GID == \'' + GID + '\')';
        let game = await logic.db_all(sql, db);
        let username = await logic.db_all('SELECT name FROM users WHERE (user_id == \'' + game[0].contributor + '\')', db);
        res.render('pages/game', {game: game, contributor: username});
    } else {
        res.redirect('/');
    }
});




// render upload page
app.get('/upload', async (req, res) => {
    if (req.session.loggedin == true) {
        res.render('pages/upload');
    } else {
        res.redirect('/');
    }
});

// upload a game
app.post('/upload', async (req, res) => {
    let body = req.body;
    let user = req.session.user;

    // validate sys_name == existing system
    let vsys = await logic.db_all('SELECT * FROM systems WHERE (name LIKE \'%' + body.sys_name + '%\')', db);
    if (vsys.length > 0 && body.title.length > 0 && body.year.length > 0) {
        let sys = vsys[0].name;
        await db_run('INSERT INTO games (title, publisher, year) VALUES (\'' + body.title + '\', \'' + body.publisher.toUpperCase() + '\', \'' + body.year + '\');');
        
        // get GID
        let gid = await logic.db_all('SELECT * FROM games WHERE (title == \'' + body.title + '\')', db);
        let GID = gid[gid.length-1].ID;

        await db_run('INSERT INTO system_games VALUES (\'' + sys + '\', \'' + GID + '\', \'' + user + '\', \'' + body.manual + '\', \'' + body.cover + '\', \'' + body.disk + '\');');
    }
    res.redirect('upload');
});






// render user account
app.get('/account', async (req, res) => {
    if (req.session.loggedin == true) {
        let GID = req.query.GID;
        let name = req.query.name;
        // delete game from fav_games
        if (GID) {
            await db_run('DELETE FROM fav_games WHERE (GID == \'' + GID + '\')');
        }
        // delete sys from fav_systems
        if (name) {
            await db_run('DELETE FROM fav_systems WHERE (sys_name == \'' + name + '\')');
        }

        let user = req.session.user;
        let ssql = 'SELECT * FROM systems JOIN fav_systems on (systems.name == fav_systems.sys_name) WHERE (UID == \'' + user + '\')'
        let gsql = 'SELECT UID, GID, sys_name, title, publisher, year FROM (SELECT GID, sys_name, title, publisher, year FROM games JOIN system_games on (games.ID == system_games.GID)) NATURAL JOIN fav_games WHERE (UID == \'' + user + '\')';
        let systems = await logic.db_all(ssql, db);
        let games = await logic.db_all(gsql, db);
        res.render('pages/account', {sys: systems, games: games});
    } else {
        res.redirect('/');
    }
});

app.post('/account', async (req, res) => {
    res.redirect('/');
});







// render login/signup page
app.get('/', (req, res) => {
    req.session.loggedin = false;
    req.session.user = null;
    res.render('pages/login');
});

// authenticate user
app.post('/', async (req, res) => {
    let user = req.body.user;
    let passwd = req.body.passwd;

    if (user && passwd) {
        let sql = 'SELECT * FROM users WHERE (name == \'' + user + '\' and passwd == \'' + passwd + '\')';
        let results = await logic.db_all(sql, db);
    
        // login or create user
        if (results.length == 0) {
            sql = 'INSERT INTO users (passwd, name) VALUES (\'' + passwd + '\', \'' + user + '\');'
            await db_run(sql);
            sql = 'SELECT * FROM users WHERE (name == \'' + user + '\' and passwd == \'' + passwd + '\')';
            results = await logic.db_all(sql, db);
        }

        req.session.loggedin = true;
        req.session.user = results[0].user_id;
        res.redirect('systems');
    } else {
        res.redirect('/');
    }
});








app.listen(port, () => {
    console.log(`listening on http://localhost:${port}...`);
});



// insert into db asynchrously
async function db_run(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, [], (err) => {
            if (err) {
                return console.error(err.message);
            }
            resolve();
        });
    });
}