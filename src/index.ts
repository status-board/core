export default class C {
    private x = 10;

    public getX = () => this.x;

    public setX = (newVal: number) => {
        this.x = newVal;
    }
}
