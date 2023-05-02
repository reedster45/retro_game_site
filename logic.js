



// construct system search query
async function systemSearch(query, db, uid) {
    let s = query.search;
    let cols = 'name, manufacturer, year, count(GID) as games';
    let tables = 'systems JOIN system_games on (systems.name == system_games.sys_name)';
    let group = ' GROUP BY systems.name';
    let sql = 'SELECT ' + cols + ' FROM ' + tables + ' WHERE (name LIKE \'%' + s + '%\')' + group;
    let fav = 'SELECT UID, sys_name FROM users JOIN fav_systems on (users.user_id == fav_systems.UID) WHERE (UID = \'' + uid + '\')';

    sql = await defaultSearch(cols, tables + group, s, sql);

    return [await db_all(sql, db), await db_all(fav, db)];
}

// construct game search query
async function gameSearch(query, db, uid) {
    let s = query.search;
    let cols = 'GID, sys_name, title, publisher, year';
    let tables = 'games JOIN system_games on (games.ID == system_games.GID)';
    let condition = '(title LIKE \'%' + s + '%\')';
    let fav = 'SELECT UID, GID FROM users JOIN fav_games on (users.user_id == fav_games.UID) WHERE (UID = \'' + uid + '\')';

    if (query.sys != undefined) {
        condition = '(system_games.sys_name == \'' + s + '\')';
    }

    let sql = 'SELECT ' + cols + ' FROM ' + tables + ' WHERE ' + condition;
    sql = await defaultSearch(cols, tables, s, sql);
    return [await db_all(sql, db), await db_all(fav, db)];
}

// check for default search
async function defaultSearch(cols, tables, s, sql) {
    if (s == undefined || s == '') {
        return 'SELECT ' + cols + ' FROM ' + tables;
    }

    return sql;
}


// query db asynchrously
async function db_all(sql, db) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                return console.error(err.message);
            }
            resolve(rows);
        });
    });
}


module.exports = {
    systemSearch,
    gameSearch,
    db_all
};