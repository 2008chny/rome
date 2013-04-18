/**
 * This module contains the implementation of the abstract base class Action, 
 * which is the core data structure generated by the contextualizer from the 
 * incoming request, HTTP or CLI.
 *
 * @module caligula.actions.base
 */
Condotti.add('caligula.actions.base', function (C) {
    
    C.namespace('caligula.actions').DEFAULT = '';
    
    /**
     * This Action class is the abstract base class, which is designed to 
     * internally represent the incoming request, HTTP or CLI. Normally it's the
     * core data structure for the request processing by being passed to the
     * router. Normally it is generated by the corresponding contextualizer 
     * from the incoming request and is a sandbox that is supposed to keep all
     * related data.
     *
     * @class Action
     * @constructor
     * @param {String} name the name of the action
     * @param {Router} router the router which is to handle this action
     */
    function Action (router) {
        /**
         * The name of the action
         * 
         * @property name
         * @type String
         */
        this.name = null;
        
        /**
         * The current router which take the responsiblity to handle this action
         *
         * @property router_
         * @type Router
         */
        this.router_ = router;
        
        /**
         * The logger instance for this context
         *
         * @property logger_
         * @type Logger
         */
        this.logger_ = C.logging.getObjectLogger(this);
        
        /**
         * The stack facility to store the frames created when current action
         * need to acquire another action in order to complete itself.
         *
         * @property stack_
         * @type Array
         * @default []
         */
        this.stack_ = [];
    }
    
    /**
     * End the current request processing flow, and return the passed-in data to
     * the client. Note that this method is expected to be called when the
     * processing successfully completes by the correct handler, otherwise
     * method "error" should be called instead.
     *
     * @method done
     * @param {Object} data the data to be returned to the client
     * @param {Object} meta the meta data that may affect the output, such as 
     *                      the HTTP status code, etc.
     */
    Action.prototype.done = function (data, meta) {
        throw new C.errors.NotImplementedError('This done method is not ' +
                                               'implemented in this abstract ' +
                                               'base class, and is expected ' +
                                               'to be overwritten in its ' +
                                               'child classes.');
    };
    
    /**
     * The same functionality with method "done", except that it is expected to
     * be called when some error occurs during the request processing.
     *
     * @method error
     * @param {Error} error the error object indicates what happened when this
     *                      error occurred
     * @param {Object} meta the meta data for this error response
     */
    Action.prototype.error = function (error, meta) {
        throw new C.errors.NotImplementedError('This error method is not ' +
                                               'implemented in this abstract ' +
                                               'base class, and is expected ' +
                                               'to be overwritten in its ' +
                                               'child classes.');
    };

    /**
     * Clone this action
     *
     * @method clone
     * @return {Action} the action cloned
     */
    Action.prototype.clone = function () {
        throw new C.errors.NotImplementedError('This clone method is not ' +
                                               'implemented in this abstract ' +
                                               'base class, and is expected ' +
                                               'to be overwritten in its ' +
                                               'child classes.');
    };
    
    /**
     * Take another action to help complete the current one, such as saving data
     * with the help of component Vatican, etc.
     *
     * @method acquire
     * @param {String} action the name of the action to be taken
     * @param {Function} callback the callback function to be invoked after the
     *                            required action has been completed 
     *                            successfully, or some error occurs. The
     *                            signature of the callback is 
     *                            'function (error, data, meta) {}'
     */
    Action.prototype.acquire = function (action, callback) {
        var self = this,
            id = this.push_();
            
        this.logger_.debug('Action ' + this.name + 
                           ' acquires another action ' + action + '\'s help. ' +
                           'Current action is pushed with frame id ' + id);
        
        this.name = action;
        this.done = function (data, meta) {
            self.logger_.debug('The required action ' + action + 
                               ' succeeded. Result: ' + 
                               C.lang.reflect.inspect(data) + ', and meta: ' +
                               C.lang.reflect.inspect(meta));
            self.pop_(id);
            callback(null, data, meta);
        };
        
        this.error = function (error, meta) {
            self.logger_.debug('The required action ' + action + 
                               ' failed. Error: ' + 
                               C.lang.reflect.inspect(error) + ', and meta: ' +
                               C.lang.reflect.inspect(meta));
            self.pop_(id);
            callback(error, null, meta);
        };
        
        try {
            this.router_.route(this);
        } catch (e) {
            this.pop_(id);
            this.logger_.debug('Trying to route the required action ' + 
                               action + ' failed. Error: ' +
                               C.lang.reflect.inspect(error));
            callback(e, null, {}); // TODO: double confirm if status is needed
        }
        
        return this;
    };
    
    
    /**
     * Push the current action frame into the stack_ property, in order to
     * be able to hook couples of properties, such as 'action', 'done' and
     * 'error', etc. The purpose to hook these properties is to complete the
     * 'acquire' method, which is used to take another action during the 
     * current action is executing in order to utilize the functionalities
     * that action provides. Since each request processing ends up by calling
     * the action's done method. But in the 'require' scenario, the calling
     * action need to acquire the control again after the required action being
     * executed, which means the done method of the passed in action to the 
     * handler factory inside 'acquire' must not terminate the processing flow.
     * That is what push_/pop_/stack_ do.
     *
     * @method push_
     * @return {Number} id of the frame pushed. This number is required when
     *                  popping a frame out of the stack in order to avoid the
     *                  multi pop issue in one time 'require'
     */
    Action.prototype.push_ = function () {

        this.logger_.debug('Context of action ' + this.name + ' is pushed ' + 
                           'into stack with the frame id ' + 
                           this.stack_.length + 1);

        return this.stack_.push({
            action: this.name,
            done: this.done,
            error: this.error
        });
    };
    
    
    /**
     * Pop an action frame from the stack_ property to restore the 
     * last environment.
     *
     * @method pop_
     * @param {Number} id the id of the frame to be popped. This number is to be
     *                    compared with the current size of the stack in order
     *                    to ensure the frame to be popped out is the correct
     *                    one. If the comparasion fails, one of the following
     *                    two behaviours will appear:
     *                    * If the stack size > id, which means a later push has
     *                      not been popped out, an error of type 
     *                      FrameNotTopOfStackError is thrown
     *                    * If the stack size < id, indicate the target frame
     *                      has been popped out sometime before, nothing is done
     *                      in this case. This behaviour is allowd because the
     *                      popping frame may happen in multi place, for example
     *                      in the callback functions, or in the error handling
     *                      branches. Now it's hare to make it clear so we just
     *                      allow all of them to be able to pop up a frame, but
     *                      ensure the frame can only be popped up once.
     *
     * @return {Boolean} exception is to be thrown when error occurs, otherwise
     *                   true means the restore has been succeeded, while false
     *                   means nothing has been done.
     */
    Action.prototype.pop_ = function (id) {
        var frame = null;

        this.logger_.debug('A frame with id ' + id.toString() + ' is going ' +
                           'to be popped from the stack of action ' + 
                           this.name + '.');

        if (id < this.stack_.length) {
            this.logger_.error(' But it seems the frame with id ' + 
                               id.toString() + ' is not the top of stack now.' +
                               'The id of the top frame in the stack is ' + 
                               this.stack_.length.toString() + '.' +
                               ' Other frames pushed later than this frame ' +
                               'should be popped first.');
                               
            throw new C.errors.FrameNotTopOfStackError(id, this.stack_.length);
            
        } else if (id > this.stack_.length) {
            this.logger_.debug(' But it seems the frame with id ' +
                               id.toString() + ' has been popped up ' +
                               'somewhere else. Nothing will be done here.');
            return false;
        }

        frame = this.stack_.pop();
        if (frame) {
            this.logger_.debug('Frame ' + id.toString() + 'is popped up with' +
                               ' name: ' + frame.action);
            this.name = frame.action;
            this.done = frame.done;
            this.error = frame.error;
            return true;
        }

        this.logger_.error('Frame ' + id.toString() + ' is popped up, but ' +
                           'nothing is found. It\'s wired.');
        return false;
    };
    
    
    C.namespace('caligula.actions').Action = Action;
    
    
    /**
     * Errors thrown when the frame to be popped is not the on the top of the
     * stack.
     *
     * @class FrameNotTopOfStackError
     * @extends Error
     * @constructor
     * @param {Number} id the id of the frame
     * @param {Number} top the id of the top frame in the stack
     */
    function FrameNotTopOfStackError (id, top) {
        this.super();
        this.id = id;
        this.top = top;
    }
    
    C.lang.inherit(FrameNotTopOfStackError, Error);
    
    FrameNotTopOfStackError.prototype.toString = function () {
        return 'Frame[id=' + this.id.toString() + '] to be popped up is not ' +
               'the top[id=' + this.top.toString() + '] of the stack.';
    };
    
    C.errors.FrameNotTopOfStackError = FrameNotTopOfStackError;
    
    
}, '0.0.1', { requires: [] });
