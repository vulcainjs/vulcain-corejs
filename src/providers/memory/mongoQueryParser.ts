
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
            return this.evaluate("$eq", left, val);
        }

        let v = this.getExpressionValue(val);
        if (v.op === "$not") {
            v = this.getExpressionValue(v.val);
            return !this.evaluate(v.op, left, v.val);
        }
        return this.evaluate(v.op, left, v.val);
    }

    private getExpressionValue(val) {
        if (!val || typeof val !== "object") {
            return { op: "$eq", val };
        }
        if (Object.prototype.toString.call(val) === '[object RegExp]') {
            return { op: "$regex", val };
        }
        let keys = Object.keys(val);
        if (keys.length !== 1)
            throw new Error("Syntax error");
        let op = keys[0];
        return { op, val: val[op] };
    }

    private evaluate(op, left, right): boolean {

        switch (op) {
            case "$eq":
                if (Array.isArray(left))
                    return left.indexOf(right) >= 0;
                return (left === right);
            case "$comment":
                return true;
            case "$lt":
                return (left < right);
            case "$gt":
                return (left > right);
            case "$lte":
                return (left <= right);
            case "$gte":
                return (left >= right);
            case "$ne":
                return (left !== right);
            case "$exists":
                return (left !== undefined) === right;
            case "$regex":
                return left && left.match(RegExp(right)) !== null;
            case "$in":
                if (!Array.isArray(right))
                    throw new Error("Syntax error for $in");
                let arr: Array<any> = Array.isArray(left) ? left : [left];
                for (let i of arr) {
                    if (right.indexOf(i) >= 0)
                        return true;
                }
                return false;
            case "$nin":
                if (!Array.isArray(right))
                    throw new Error("Syntax error for $nin");
                let arr2: Array<any> = Array.isArray(left) ? left : [left];
                for (let i of arr2) {
                    if (right.indexOf(i) >= 0)
                        return false;
                }
                return true;
            case "$startsWith":
                return left && ((<string>left).startsWith(right));
            case "$mod":
                if (!Array.isArray(right))
                    throw new Error("Syntax error for $mod");
                let divider = parseInt(right[0]);
                let remainder = parseInt(right[1]);
                return left % divider === remainder;
            case "$elemMatch":
                if (!left) return false;
                if (!Array.isArray(left))
                    throw new Error("Syntax error for $elemMatch");
                for (let elem of left) {
                    if (this.executeExpression(elem, right))
                        return true;
                }
                return false;
            case "$all":
                if (!left) return false;
                if (!Array.isArray(right) && !Array.isArray(left))
                    throw new Error("Syntax error for $all");
                for (let elem of left) {
                    if (right.indexOf(elem) <= 0)
                        return false;
                }
                return true;
            case "$size":
                if (!left) return false;
                if (!Array.isArray(left))
                    throw new Error("Syntax error for $size");
                return left.length === right;
            default:
                throw new Error("Operator not implemented");
        }
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