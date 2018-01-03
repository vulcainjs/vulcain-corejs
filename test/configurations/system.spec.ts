import {expect} from "chai";
import {Service} from "../../dist/globals/system";

let urlExcepted = "http://localhost:8080/api/alert?tag=RED&tag=BLUE&in=00001";
let urlExceptedPath = "http://localhost:8080/api/alert/id";

describe('SystemHelper', function () {

    it('should create url with query string', function () {
        expect(Service.createUrl("http://localhost:8080/api/alert?tag=RED&tag=BLUE", {
            in: "00001"
        })).to.equal(urlExcepted);
    });

    it('should create url with path', function () {
        expect(Service.createUrl("http://localhost:8080/api/alert", "id")).to.equal(urlExceptedPath);
    });


    it('should expected an error with querystring and path', function () {
        expect(function () {
            Service.createUrl("http://localhost:8080/api/alert?type=RED", "id");
        }).to.throw(Error);
    });


});
