import { Model, ApplicationBuilder, Property, QueryHandler, ActionHandler } from 'vulcain-corejs';
// Very simple microservice

// Declare a simple customer model with default CRUD handler and anonymous access
@Model()
@QueryHandler({scope:'?'})
@ActionHandler({scope:'?'})
class Customer {
    @Property({type:'string', required: true, isKey: true})
    firstName: string;
    @Property({type:'string', required: true})
    lastName: string;
}
// Run the microservice on port 8080
// try: http://localhost:8080/api/_servicedescription
//      http://localhost:8080/metrics (Prometheus metrics)
let app = new ApplicationBuilder('test')
    // Run a mongo docker container and uncomment the next line
    //.useMongo('localhost')
    .runAsync();