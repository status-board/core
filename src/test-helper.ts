import Chance from 'chance';
import { Subscription } from './bus';

const chance = new Chance();

export const generateSubscription = (id: string = chance.string(), clients: string[] = [], params: any = undefined): Subscription => ({
    id,
    clients,
    params,
});
