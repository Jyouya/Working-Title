module.exports = function (authorizer) {
    authorizer.register('/login', ['default'], ['GET','POST'], {ignore: true});

    authorizer.register('/register', ['default', 'basic', 'mod', 'admin'], ['GET']);
    authorizer.register('/api/users', ['default', 'admin'], ['POST']); // Account registration

    
    authorizer.register('/', ['default', 'basic', 'mod', 'admin'], ['GET']);
    authorizer.register('/home', ['default', 'basic', 'mod', 'admin'], ['GET']);
    authorizer.register('/profile', ['default', 'basic', 'mod', 'admin'], ['GET']); 
    
    authorizer.register('/posts', ['basic', 'mod', 'admin'], ['POST']);
    authorizer.register('/posts', ['default'], ['GET']);


    // Test routes
    authorizer.register('/api/restrictedtest', ['basic', 'admin'], ['GET']);
    authorizer.register('/api/restrictedtest', ['admin'], ['POST']);
    
    authorizer.register('/api/authtest', ['basic', 'mod', 'admin'], ['GET', 'POST']);



    
}