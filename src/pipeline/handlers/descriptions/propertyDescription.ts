export class PropertyDescription {
    name: string;
    required: boolean;
    description: string;
    type: string;
    typeDescription: string;
    reference?: "no" | "many" | "one";
    definition: any;
    order: number;
}
