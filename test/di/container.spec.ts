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

describe("Dependency injection", function () {

    it("should inject properties", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);

        let clazz = container.get<ClassB>('ClassB');
        expect(clazz.classA).to.be.not.null;
    });

    it("should failed if component does not exist", () => {
        let container = new Container();
        container.injectSingleton(ClassA);
        container.injectSingleton(ClassB);

        expect(() => {
            let clazz = container.get<ClassC>('ClassC');
        })
        .to.throw();
    });
});
