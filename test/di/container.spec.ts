import { expect } from 'chai';
import { LifeTime, Inject } from '../../dist/di/annotations';
import { Container } from '../../dist/di/containers';

export class ClassA {
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

    it("should inject properties", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);

        let clazz = container.get<ClassB>('ClassB');
        expect(clazz.classA).to.be.not.null;
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
