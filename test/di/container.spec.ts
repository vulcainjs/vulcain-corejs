import { expect } from 'chai';
import { LifeTime, Inject } from '../../dist/di/annotations';
import { Container } from '../../dist/di/containers';

export class ClassA {
}

export class OverrideClassA {
}

export class ClassB {
    @Inject()
    classA: ClassA;
    @Inject('ClassZ', true)
    classZ: ClassA;
}

export class ClassC {
    @Inject('ClassZ')
    classA: ClassA;
}

export class ClassD extends ClassB {
    @Inject('ClassA')
    classAA: ClassA;
}

describe("Dependency injection", function () {

    it("should inject singletons", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);

        let clazz = container.get<ClassB>('ClassB');
        expect(clazz.classA).to.be.not.null;
    });

    it("should override component", () => {
        let container = new Container();
        container.injectInstance(ClassA, "C1");
        let clazz = container.get<any>('C1');
        expect(clazz.name).to.be.equal("ClassA");

        container.injectInstance(ClassB, "C1");

        clazz = container.get<any>('C1');
        expect(clazz.name).to.be.equal("ClassB");
    });

    it("should get multiple components", () => {
        let container = new Container();
        container.injectSingleton(ClassA, "C1");
        container.injectSingleton(OverrideClassA, "C1");
        let classes = container.getList<any>('C1');
        expect(classes.length).to.be.equal(2);
    });

    it("should inject parent properties", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);
        container.injectSingleton(ClassD);

        let clazz = container.get<ClassD>('ClassD');
        expect(clazz.classA).to.be.not.null;
        expect(clazz.classAA).to.be.not.null;
    });

    it("should failed if component does not exist", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);
        container.injectSingleton(ClassC);

        expect(() => {
            let clazz = container.get<ClassC>('ClassC');
        })
        .to.throw();
    });
});
