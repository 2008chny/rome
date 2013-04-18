/**
 * This module contains the mongodb version of the database-specific
 * implementations, such as the MongoConnectionFactory, etc.
 *
 * @module caligula.components.data.mongo
 */
Condotti.add('caligula.components.data.mongo', function (C) {
    // TODO: add the description of the data structures of the passed in param
    
    /**
     * This MongoConnection class is designed to provide CRUD functionalities
     * onto the mongodb servers.
     *
     * @class MongoConnection
     * @constructor
     * @param {MongoConnectionFactory} factory the factory that creates this
     *                                         connection
     * @param {Collection} collection the collection instance obtained from the
     *                                factory after establishing connection to
     *                                the mongodb server and opened the required
     *                                collection
     */
    function MongoConnection (factory, collection) {
        /**
         * The factory which creates this connection
         * 
         * @property factory_
         * @type MongoConnection
         * @deafult factory
         */
        this.factory_ = factory;
        
        /**
         * The collection opened
         * 
         * @property collection_
         * @type Collection
         * @deafult collection
         */
        this.collection_ = collection;
    }
    
    /**
     * Close this connection, which actually closes the internal db object now.
     * Later if the connection pool inside the mongodb driver does not work, a
     * high-level connection pool is to be implemented in the factory class,
     * at that time, this close method is expected to ask the factory to check
     * in this connection.
     *
     * @method close
     */
    MongoConnection.prototype.close = function () {
        this.collection_ && this.collection_.db.close();
    };
    
    /**
     * Insert a data record into the collection
     *
     * @method create
     * @param {Object} data the data record to be inserted into
     * @param {Function} callback the callback function to be invoked after the
     *                            insertion has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.create = function (data, callback) {
        this.collection_.insert(data, { w: 1 }, function (error, result) {
            if (error) {
                callback(error, null);
                return;
            }
            callback(null, result.length); // here the 'result' is exactly the
                                           // array of the objects contained in
                                           // the data param, but not the data
                                           // returned from the database after
                                           // insertion.
        });
    };
    
    /**
     * Update the specified data records with the operators in the passed in
     * param
     *
     * @method update
     * @param {Object} data the data object contains the criteria and the
     *                      operators
     * @param {Function} callback the callback function to be invoked after the
     *                            updating has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.update = function (data, callback) {
        this.collection_.update(
            data.criteria, data.update, { w: 1, multi: true }, callback
        );
    };
    
    /**
     * Delete the data records in the collection which fulfill the criteria
     * specified in the passed-in data object
     *
     * @method delete
     * @param {Object} data the data object which contains the criteria
     * @param {Function} callback the callback function to be invoked after the
     *                            deleting has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.delete = function (data, callback) {
        this.collection_.remove(data.criteria, { w: 1 }, callback);
    };
    
    /**
     * Return the number of the records fulfill the specified criteria and
     * the scope from 'skip' to 'skip' + 'limit'
     *
     * @method count
     * @param {Object} data the data object contains the criteria and the scope
     * @param {Function} callback the callback function to be invoked after the
     *                            counting has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.count = function (data, callback) {
        var criteria = data.criteria || {},
            operations = data.operations || {};
        

        this.collection_.count(criteria, {
            skip: operations.skip,
            limit: operations.limit
        }, callback);
    };

    /**
     * Implement the 'group by' functionality with the help of the aggregation
     * framework of Mongodb.
     *
     * @method group
     * @param {Object} data the data object contains the fields to group by, and
     *                      other options, such as the criteria to filter 
     *                      records first, and the operations to specify the
     *                      skip and limit settings, etc.
     * @param {Function} callback the callback function to be invoked after the
     *                            grouping has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.group = function (data, callback) {
        //
    };

    /**
     * Read the data records which fulfill the specified criteria contained in
     * the passed-in param
     *
     * @method read
     * @param {Object} data the data contains the query criteria
     * @param {Function} callback the callback function to be invoked after the
     *                            updating has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.read = function (data, callback) {
        var criteria = data.criteria,
            fields = data.fields,
            operations = data.operations,
            cursor = null;
        
        // no exception is to be caught here, since the params, 
        // criteria, fields are all supposed to be object, not buffer, 
        // which can not lead to an exception
        cursor = this.collection_.find(criteria, fields, operations);
        cursor.toArray(function (error, result) {
            cursor.close();
            callback(error, result);
        });
        
    };
    
    /**
     * The "compare and set" implementation via the help of the FinaAndModify
     * command provided by mongodb
     *
     * @method cas
     * @param {Object} data the data contains the compare part and set part
     * @param {Function} callback the callback function to be invoked after the
     *                            updating has been successfully completed, or
     *                            some error occurs. The signature of the
     *                            callback is 'function (error, result) {}'
     */
    MongoConnection.prototype.cas = function (data, callback) {
        data.operations = data.operations || {};
        data.operations.w = 1;
        
        this.collection_.findAndModify(
            data.compare, data.set, data.operations, callback
        );
    };
    
    /**
     * This MongoConnectionFactory is an implementation of the connection
     * factory used by the data handler to create connections to the mongodb
     * servers.
     *
     * @class MongoConnectionFactory
     * @constructor
     * @extends 
     * @param {Object} config the config object for this factory
     */
    function MongoConnectionFactory (config) {
        /**
         * The config object for this factory
         *
         * @property config_
         * @type Object
         */
        this.config_ = config;
        
        /**
         * The logger instance for this factory
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
        
        /**
         * The connection url used to connect mongodb server
         * 
         * @property url_
         * @type String
         * @deafult 'mongodb://localhost'
         */
        this.url_ = this.config_.url || 'mongodb://localhost';
        
        /**
         * Options used when creating connection to mongodb servers
         * 
         * @property options_
         * @type Object
         * @deafult {}
         */
        this.options_ = this.config_.options || {};
    }
    
    /**
     * Return a connection to the specified database on the configured mongodb
     * server.
     *
     * @method get
     * @param {String} name the name of the connection to be returned
     * @param {Function} callback the callback function to be invoked when the
     *                            connection is successfully created, or some
     *                            error occurs. The signature of the callback
     *                            is 'function (error, collection) {}'
     */
    MongoConnectionFactory.prototype.get = function (name, callback) {
        var mongodb = C.require('mongodb'),
            self = this,
            message = null;
            
        C.async.waterfall([
            function (next) {
                message = 'Connecting to mongodb server with url ' + self.url_ +
                          ', options ' + self.options_;
                mongodb.Db.connect(this.url_, this.options_, next);
            },
            function (db, next) {
                self.logger_.debug(message + ' succeed.');
                message = 'Opening collection ' + name + ' ...';
                db.collection(name, next);
            }
        ], function (error, result) {
            if (error) {
                self.logger_.debug(message + ' failed. Error: ' +
                                   C.lang.reflect.inspect(error));
                callback(error, null);
            }
            
            self.logger_.debug(message + ' succeed. Result: ' + 
                               C.lang.reflect.inspect(result));
            callback(null, new MongoConnection(self, result));
        });
    };
    
    C.namespace('caligula.db.mongo').MongoConnectionFactory = MongoConnectionFactory;
    
}, '0.0.1', { requires: [] });
