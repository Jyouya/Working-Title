'use strict';
const emojiRegex = require('../emoji-validation-regex');
const Op = require('sequelize').Op;

// constants for calculating cache update frequency.
const n = 18 * Math.log(3) / Math.log(6);
const d = 9 / Math.log(6);
const fifteenMinutes = 15 * 1000 * 60;

const ageCoefficient = 1 / (60 * 60 * 1000); // Changes age from milliseconds to hours

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        is: emojiRegex
      }
    },
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    replyId: {
      type: DataTypes.INTEGER
    },  
    cacheExpiration: {
      type: DataTypes.DATE,
    },
    trendingIndex: {
      type: DataTypes.VIRTUAL(),
      get() {
        console.log('debugdebugdebug');
        // our cached value is too old, we need to recalculate it
        if (new Date() > (this.cacheExpiration || 0)) {
          // if (true) {
          // Expiration interval is a sigmoid, so it expires often on new posts, and rarely on old posts.
          // Right now the interval is 90 seconds for new posts, and fifteen minutes for old posts.
          // Should recalculate to make it go up to a 6 hours for old posts.

          const age = (new Date() - this.createdAt) * ageCoefficient;

          const nextExpiration = new Date().getTime() + (fifteenMinutes / (1 + Math.E ** (- (age - n) / d)));
          console.log(`age: ${age}, cacheExpiration: ${new Date(nextExpiration) - new Date()}`)


          this.update({ cacheExpiration: nextExpiration });

          // recalculate index
          this.recalculateTrendingIndex();
        }
        return this.cachedTrendingIndex || .1;
      }
    },
    cachedTrendingIndex: {
      type: DataTypes.DOUBLE,
    },
    weight: {
      type: DataTypes.FLOAT,
      defaultValue: 1000 / Math.sqrt(Math.PI * 2 * ((1000 * 60 * 60 * 6) ** 2)),
    },
    // createdAt and updatedAt are auto-generated by sequelize.
  }, {
      instanceMethods: {
        getReplyingTo: function () {
          return this.sequelize.models.Post.findByPrimary(this.replyId);
        },
        setReplyingTo: function (ReplyingToPost) {
          return this.update({ replyId: replyingToPost.id });
        },

      }
    }
  )

  {
    // Define constants for our formula
    const sixHours = 1000 * 60 * 60 * 6; // 6 hours
    const oneDay = 1000 * 60 * 60 * 24; // 24 hours

    const r = 2 * sixHours ** 2;
    const k = 1000 / (Math.sqrt(Math.PI * r));
    const d = 1 / r;

    const final = k * Math.E ** (-1 * oneDay ** 2 * d);

    Post.prototype.weigh = function () {
      // How is it even possible for 'this' to be an array?
      const age = new Date() - this.createdAt;
      let weight;
      if (age > oneDay) {
        weight = final;
      } else {
        const p = - age * age * d;
        weight = k * Math.E ** p;
      }
      this.update({weight: weight});

      return this.setDataValue('weight', weight);
    }

    Post.prototype.recalculateTrendingIndex = async function () {
      let total = [];

      const likes = this.sequelize.models.Like.findAll({
        where: {
          PostId: this.id
        }
      });

      const replies = this.sequelize.models.Post.findAll({
        where: {
          replyId: this.id
        }
      });

      const afterLikes = likes.then(likes => {
        likes.forEach(async like => {
          await like.weigh();
          total.push(like.weight);
        });
      });

      const afterReplies = replies.then(replies => {
        replies.forEach(async reply => {
          await reply.weigh();
          total.push(reply.weight);
        });

      });

      await afterLikes;
      await afterReplies;

      const age = Date.now() - this.createdAt;

      const ageFactorA = getAgeFactorA(age);
      const ageFactorB = getAgeFactorB(age);

      // console.log(ageFactorA, ageFactorB);

      this._trendingIndex = total.reduce((a, b) => a + b * ageFactorA, 0) + ageFactorB;

      this.update({ cachedTrendingIndex: this._trendingIndex });
    }
  }

  Post.prototype.likePost = async function (user) {
    const like = await this.sequelize.models.Like.findOrCreate({
      where: {
        UserId: user,
        PostId: this.id
      }
    });
  }

  // Have user like their own post
  Post.addHook('afterCreate', (post, options) => {
    post.sequelize.models.Like.create({
      PostId: post.id,
      UserId: post.UserId
    });
  });

  Post.associate = function (models) {
    Post.belongsTo(models.User, {
      foreignKey: {
        allowNull: false
      }
    });
    Post.hasMany(models.Post, {
      as: 'Replies',
      foreignKey: 'replyId'
    });

    Post.hasMany(models.Like);
    // Post.hasMany(models.Like)
  }
  return Post;
};

// Return the coefficient by which to multiply engagement
{
  const x = 118800000;
  const y = -27000000 / Math.log(3);
  var getAgeFactorA = function (age) {
    const p = -1 * (age - x) / y;
    return 1 / (1 + Math.E ** p);
  }

  const m = (-5 * 100 / Math.sqrt(Math.PI * 2 * (1000 * 60 * 60 * 6)**2)) / (1000 * 60 * 60); // -5 likes per hour
  var getAgeFactorB = function (age) {
    return m * age;
  }
}
