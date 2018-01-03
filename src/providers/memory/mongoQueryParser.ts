
export class MongoQueryParser {

    constructor(private query) {
    }

    execute(entity) {
        if (!this.query) return true;
        return this.executeExpression(entity, this.query);
    }

    private executeExpression(entity, query) {
        let keys = Object.keys(query);
        if (keys.length === 0) return true;
        let op = keys[0];
        let val;
        switch (op) {
            case "$or":
                val = query[op];
                if (!Array.isArray(val))
                    throw new Error("Syntax error in logical expression");
                for (let o of val) {
                    if (this.executeExpression(entity, o))
                        return true;
                }
                return false;
            case "$and":
                val = query[op];
                if (!Array.isArray(val))
                    throw new Error("Syntax error in logical expression");
                for (let o of val) {
                    if (!this.executeExpression(entity, o))
                        return false;
                }
                return true;
            case "$nor":
                val = query[op];
                if (!Array.isArray(val))
                    throw new Error("Syntax error in logical expression");
                for (let o of val) {
                    if (this.executeExpression(entity, o))
                        return false;
                }
                return true;
            default:
                if (keys.length > 1) {
                    for (let k of keys) {
                        let obj = {};
                        obj[k] = query[k];
                        if (!this.executeOperator(entity, obj))
                            return false;
                    }
                }
                else {
                    if (!this.executeOperator(entity, query))
                        return false;
                }
        }

        return true;
    }

    private executeOperator(entity, query) {
        let keys = Object.keys(query);
        if (keys.length !== 1)
            throw new Error("Syntax error");
        let k = keys[0];
        let left = this.getFieldValue(entity, k);

        let val = query[k];
        if (typeof val !== "object") {
            return this.evaluate({ "$eq": val }, left);
        }

        let v = this.getExpressionValue(val);
        if (v["$not"]) {
            v = this.getExpressionValue(v["$not"]);
            return !this.evaluate(v, left);
        }
        return this.evaluate(v, left);
    }

    private getExpressionValue(val) {
        if (!val || typeof val !== "object") {
            return {"$eq": val };
        }
        if (Object.prototype.toString.call(val) === '[object RegExp]') {
            return { "$regex": val };
        }
        return val;
    }

    private evaluate(op, left): boolean {
        let opval;
        if (opval = op["$eq"]) {
            if (Array.isArray(left))
                return left.indexOf(opval) >= 0;
            return (left === opval);
        } else if (opval = op["$comment"]) {
            return true;
        } else if (opval = op["$lt"]) {
            return (left < opval);
        } else if (opval = op["$gt"]) {
            return (left > opval);
        } else if (opval = op["$lte"]) {
            return (left <= opval);
        } else if (opval = op["$gte"]) {
            return (left >= opval);
        } else if (opval = op["$ne"]) {
            return (left !== opval);
        } else if (opval = op["$exists"]) {
            return (left !== undefined) === opval;
        } else if (opval = op["$regex"]) {
            return left && (<string>left).match(RegExp(opval, op.$options)) !== null;
        } else if (opval = op["$in"]) {
            if (!Array.isArray(opval))
                throw new Error("Syntax error for $in");
            let arr: Array<any> = Array.isArray(left) ? left : [left];
            for (let i of arr) {
                if (opval.indexOf(i) >= 0)
                    return true;
            }
            return false;
        } else if (opval = op["$nin"]) {
            if (!Array.isArray(opval))
                throw new Error("Syntax error for $nin");
            let arr2: Array<any> = Array.isArray(left) ? left : [left];
            for (let i of arr2) {
                if (opval.indexOf(i) >= 0)
                    return false;
            }
            return true;
            //}    else if(opval = op["$startsWith":
            //        return left && ((<string>left).startsWith(right));
        } else if (opval = op["$mod"]) {
            if (!Array.isArray(opval))
                throw new Error("Syntax error for $mod");
            let divider = parseInt(opval[0]);
            let remainder = parseInt(opval[1]);
            return left % divider === remainder;
        } else if (opval = op["$elemMatch"]) {
            if (!left) return false;
            if (!Array.isArray(left))
                throw new Error("Syntax error for $elemMatch");
            for (let elem of left) {
                if (this.executeExpression(elem, opval))
                    return true;
            }
            return false;
        } else if (opval = op["$all"]) {
            if (!left) return false;
            if (!Array.isArray(opval) && !Array.isArray(left))
                throw new Error("Syntax error for $all");
            for (let elem of left) {
                if (opval.indexOf(elem) <= 0)
                    return false;
            }
            return true;
        } else if (opval = op["$size"]) {
            if (!left) return false;
            if (!Array.isArray(left))
                throw new Error("Syntax error for $size");
            return left.length === opval;
        } else
            throw new Error("Operator not implemented");
    }


    private getFieldValue(entity, path: string) {
        let current = entity;
        let parts = path.split('.');
        for (let part of parts) {
            current = current && current[part];
        }
        return current;
    }
}