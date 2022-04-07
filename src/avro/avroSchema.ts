import {Expose, Type as ClassType} from "class-transformer";
import {inputName} from "./avroUtils.js";

export class AvroSchema  {
    @ClassType(() => Type) //TODO: handle all three types
    type: string | Type | Type[] = "";

    @ClassType(() => Field)
    fields: Field[] = [];

    @ClassType(() => Transformation)
    transformations: Transformation[] = [];

    @Expose({ name: 'xjoin.type' })
    xjoinType: string = "";

    name: string = "";
    namespace: string = "";
    connectName: string = "";
}

export class Type {
    @ClassType(() => Type) //TODO: handle all three types
    items: string | Type | Type[] = "";

    @ClassType(() => Field)
    fields: Field[] = [];

    @ClassType(() => Field)
    @Expose({ name: 'xjoin.fields' })
    xjoinFields: Field[] = [];

    @Expose({ name: 'xjoin.type' })
    xjoinType: string = "";

    @Expose({ name: 'connect.version' })
    connectVersion: bigint = BigInt(1);

    @Expose({ name: 'connect.name' })
    connectName: string = "";

    @Expose({ name: 'xjoin.case' })
    xjoinCase: string = "";

    @Expose({ name: 'xjoin.enumeration' })
    xjoinEnumeration: boolean = false;

    @Expose({ name: 'xjoin.primary.key' })
    xjoinPrimaryKey: boolean = false;

    type: string = "";
    name: string = "";
}

export class Field {
    @ClassType(() => Type)
    type: string | Type | Type[] = "";

    @Expose({ name: 'xjoin.index' })
    xjoinIndex: boolean = true;

    @Expose({ name: 'xjoin.type' })
    xjoinType: string = "";

    @Expose({ name: 'xjoin.enumeration' })
    xjoinEnumeration: boolean = true;

    @Expose({ name: 'xjoin.primary.key' })
    xjoinPrimaryKey: boolean = false;

    name: string = "";
    default: string = "";

    getGraphQLType() : string {
        return typeConversion(this).graphqlType;
    }

    getFilterType() : string {
        return typeConversion(this).filterType;
    }

    getEnumeration(): boolean {
        return typeConversion(this).enumeration;
    }

    getPrimaryKey(): boolean {
        return typeConversion(this).primaryKey;
    }

    getAvroType(): string {
        return typeConversion(this).avroType;
    }

    getXJoinType(): string {
        return typeConversion(this).xjoinType;
    }

    getChildren() : Field[] {
        let childFields : Field[] = [];
        if (Array.isArray(this.type)) {
            childFields = this.type[1].fields; //TODO can't assume type[1]
            if (childFields.length === 0) {
                childFields = this.type[1].xjoinFields;
            }
        } else if (typeof this.type === 'object') {
            childFields = this.type.fields;
            if (childFields.length === 0) {
                childFields = this.type.xjoinFields;
            }
        }
        return childFields;
    }

    hasChildren() : boolean {
        const children = this.getChildren();
        return children != null && children.length > 0;
    }

    setEnumeration(value: boolean) {
        if (typeof this.type === 'string') {
            this.xjoinEnumeration = true;
        } else if (Array.isArray(this.type)) {
            this.type[1].xjoinEnumeration = value;
        } else { //single type object
            this.type.xjoinEnumeration = value;
        }

        this.xjoinEnumeration = value;
    }

    validate() {
        if (!this.name) {
            throw Error(`field is missing name attribute`)
        }
        if (!this.getAvroType()) {
            throw Error(`field ${this.name} is missing type attribute`)
        }
        if (!this.getXJoinType()) {
            throw Error(`field ${this.name} is missing xjoin.type attribute`)
        }

    }
}

export class Transformation {
    @Expose({ name: 'input.field' })
    inputField: string = "";

    @Expose({ name: 'output.field' })
    outputField: string = "";

    type: string = "";
    parameters: object = {};
}

type FieldTypes = {
    graphqlType: string,
    filterType: string,
    enumeration: boolean,
    primaryKey: boolean,
    avroType: string,
    xjoinType: string
}

function typeConversion(field: Field): FieldTypes {
    let typeString;
    let enumeration;
    let primaryKey = false;
    let avroType;
    let xjoinType;
    if (typeof field.type === 'string') {
        xjoinType = field.xjoinType;
        avroType = field.type;
        typeString = field.type; //TODO: xjoinType
        enumeration = field.xjoinEnumeration;
    } else if (Array.isArray(field.type)) {
        avroType = field.type[1].type;
        typeString = field.type[1].xjoinType;
        enumeration = field.type[1].xjoinEnumeration;
        primaryKey = field.type[1].xjoinPrimaryKey;
        xjoinType = field.type[1].xjoinType;
    } else { //single type object
        avroType = field.type.type;
        typeString = field.type.xjoinType;
        enumeration = field.type.xjoinEnumeration;
        primaryKey = field.type.xjoinPrimaryKey;
        xjoinType = field.type.xjoinType;
    }

    const response : FieldTypes = {
        graphqlType: "",
        filterType: "",
        enumeration,
        primaryKey,
        avroType,
        xjoinType
    };

    switch (typeString) {
        case 'date_nanos': {
            response.graphqlType = 'String';
            response.filterType = 'FilterTimestamp';
            break;
        }
        case 'string': {
            response.graphqlType = 'String';
            response.filterType = 'FilterString';
            break;
        }
        case 'boolean': {
            response.graphqlType = 'Boolean';
            response.filterType = 'FilterBoolean';
            break;
        }
        case 'json': {
            response.graphqlType = 'Object';

            if (field.hasChildren()) {
                response.filterType = inputName(field.name)
            } else {
                response.filterType = "";
            }
            break;
        }
        case 'record': { //TODO: is this a valid xjoin.type?
            response.graphqlType = 'Object';
            response.filterType = 'FilterString';
            break;
        }
        case 'reference': {
            response.graphqlType = 'Reference';
            response.filterType = 'FilterString';
            break;
        }
        case 'array': {
            response.graphqlType = '[String]'; //TODO handle different array item types
            response.filterType = 'FilterStringArray';
            break;
        }
        default: {
            response.graphqlType = 'String';
            response.filterType = 'FilterString';
            break;
        }
    }

    return response;
}

