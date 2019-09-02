const db = require('../models');
const auth = require('./authentication');
const verify = require('../verify');


module.exports = (app) => {
    auth(app, db); // Create POST routes for /api/login and /api/users

    require('./regex-route')(app);

    // A test route for automated testing.  Don't change.
    app.post('/api/authtest', async function (req, res) {
        try {
            // const { userId, type } = await verify(req.body.jwt, req);
            const userId = req.userId;
            const username = (await db.User.findOne({
                where: {
                    id: userId
                }
            })).username

            res.json({
                msg: `Hello ${username}`
            });
        } catch (err) {
            console.log(err);
            res.status(403).json({ msg: err });
        }
    });

    // Gets all users
    app.get('/api/users', async function (req, res) {
        const user = req.query.user;
        res.json(await db.User.findAll({
            where: { ...user && { id: user } },
            attributes: ["id", "username", "bannerImg", "avatarImg", "bio"],
            include: [db.Post]
        }));
    });

    app.post('/api/posts', async function (req, res) {
        console.log(req.body);
        await db.Post.create({
            content: req.body.content,
            UserId: req.userId,
            replyId: req.body.replyId || null,
        });
        res.json({ msg: 'Post added successfuly' });
    });

    // IF the user uses /api/posts?count=10, will send 10 back; otherwise 20
    app.get("/api/posts/", async function (req, res) {
        const count = parseInt(req.query.count) || 20;
        console.log("================================================ " + count, typeof (count));
        console.log(`User: "${req.query.user}"`);
        const user = req.query.user;
        const output = await db.Post.findAll({
            where: { ...user && { UserId: user } },
            limit: count,
            include: [{
                model: db.User,
                attributes: ["username", "avatarImg", "id"]
            }],
            order: [['cachedTrendingIndex', 'DESC']],
            attributes: ['UserId', 'id', 'content', 'createdAt', 'replyId']
        });
        res.json(output);
    });

    app.route('/api/likes/:post')
        .post(async function(req, res) {
            console.log(`${req.userId} liked ${req.params.post}`)
            const post = await db.Post.findByPk(req.params.post);
            // console.log(post);
            post.likePost(req.userId);
        });

    app.route('/api/restrictedtest')
        .get(function (req, res) {
            res.json({
                msg: 'You got the thing!'
            });
        })
        .post(function (req, res) {
            res.json({
                msg: 'You posted the thing!'
            });
        });

    app.route('/api/trendingtest')
        .get(async function (req, res) {
            const posts = await db.Post.findAll({
                order: [['cachedTrendingIndex', 'DESC']]
            });
            res.json(posts);
        });

    

    // app.get('/api/users/:id', async function (req, res) {
    //     const id = req.params.id;
    //     res.json(await db.User.findOne({
    //         where: {
    //             id: id
    //         }
    //     }));
    // });

};

