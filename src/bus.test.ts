import { Socket } from 'socket.io';
import { Signale } from 'signale';
import Bus, { PollMode, Subscription } from './bus';
import { generateSubscription } from './test-helper';

let logger: Signale;

describe('Bus', (): void => {
    beforeEach(() => {
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as unknown as Signale;
    });

    afterEach((): void => {
        jest.resetAllMocks();
    });

    it('clientCount() should return the number of connected clients', (): void => {
        const bus = new Bus({ logger });

        expect(bus.clientCount()).toBe(0);

        bus.addClient({ id: 'client_a' } as unknown as Socket);
        bus.addClient({ id: 'client_b' } as unknown as Socket);
        bus.addClient({ id: 'client_c' } as unknown as Socket);

        expect(bus.clientCount()).toBe(3);
    });

    describe('addClient', (): void => {
        it('should add a client to the current list', (): void => {
            const bus = new Bus({ logger });

            bus.addClient({ id: 'test_client' } as unknown as Socket);

            expect(bus.listClients()).toHaveProperty('test_client');

            expect(logger.info).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Client #test_client connected');
        });

        it('should throw if a client with the same id already exists', (): void => {
            const id = 'test_client';
            const bus = new Bus({ logger });

            bus.addClient({ id } as unknown as Socket);

            expect((): void => {
                bus.addClient({ id } as unknown as Socket);
            }).toThrow(`Client with id '${id}' already exists`);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(`Client with id '${id}' already exists`);
        });
    });

    describe('processApiCall', (): void => {
        it('should log api call', () => {
            const bus = new Bus({ logger });

            expect.assertions(2);

            return bus.processApiCall('test_api.test_method', () => {
            }).then((): void => {
                expect(logger.info).toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledWith('Calling \'test_api.test_method\'');
            });
        });

        it('should support calling apis which return promises', () => {
            const bus = new Bus({ logger });

            const apiMock = jest.fn(() => Promise.resolve('test'));
            const apiParams = { param: 'param' };

            expect.assertions(3);

            return bus.processApiCall('test_api.test_method', apiMock, apiParams).then((message) => {
                expect(apiMock).toHaveBeenCalled();
                expect(apiMock).toHaveBeenCalledWith(apiParams);
                expect(message).toEqual({
                    id: 'test_api.test_method',
                    data: 'test',
                });
            });
        });

        it('should support calling apis which does not return promises', () => {
            const bus = new Bus({ logger });

            const apiMock = jest.fn(() => 'test');
            const apiParams = { param: 'param' };

            expect.assertions(3);

            return bus.processApiCall('test_api.test_method', apiMock, apiParams).then((message) => {
                expect(apiMock).toHaveBeenCalled();
                expect(apiMock).toHaveBeenCalledWith(apiParams);
                expect(message).toEqual({
                    id: 'test_api.test_method',
                    data: 'test',
                });
            });
        });

        it('should cache result', () => {
            const bus = new Bus({ logger });

            bus.subscriptions['test_api.test_method'] = generateSubscription();

            expect.assertions(3);

            return bus.processApiCall('test_api.test_method', () => 'test').then(() => {
                const subscriptions = bus.listSubscriptions();
                expect(subscriptions['test_api.test_method']).not.toBeUndefined();
                expect(subscriptions['test_api.test_method']).toHaveProperty('cached');
                expect(subscriptions['test_api.test_method'].cached).toEqual({
                    id: 'test_api.test_method',
                    data: 'test',
                });
            });
        });

        it('should notify clients on success', () => {
            const bus = new Bus({ logger });
            const expectedClients = ['testClient'];

            const emitMock = jest.fn();
            bus.clients = {
                testClient: { emit: emitMock } as unknown as Socket,
            };
            bus.subscriptions = {
                'test_api.test_method': generateSubscription(undefined, expectedClients),
            };

            expect.assertions(2);

            return bus.processApiCall('test_api.test_method', () => 'test').then(() => {
                expect(emitMock).toHaveBeenCalled();
                expect(emitMock).toHaveBeenCalledWith('api.data', {
                    id: 'test_api.test_method',
                    data: 'test',
                });
            });
        });

        it('should not notify clients on error and log error', () => {
            const bus = new Bus({ logger });
            const expectedClients = ['testClient'];

            const emitMock = jest.fn();
            bus.clients = {
                testClient: { emit: emitMock } as unknown as Socket,
            };
            bus.subscriptions = {
                'test_api.test_method': generateSubscription(undefined, expectedClients),
            };

            expect.assertions(4);

            return bus
                .processApiCall('test_api.test_method', () => Promise.reject({ status: -1 }))
                .then(() => {
                    expect(emitMock).toHaveBeenCalledTimes(1);
                    expect(emitMock).toHaveBeenCalledWith('api.error', {
                        data: { message: undefined },
                        id: 'test_api.test_method',
                    });
                    expect(logger.error).toHaveBeenCalled();
                    expect(logger.error).toHaveBeenCalledWith(
                        '[test_api] test_api.test_method - status code: -1',
                    );
                });
        });
    });

    describe('registerApi', (): void => {
        it('should make the API available', (): void => {
            const bus = new Bus({ logger });

            bus.registerApi('test_api', () => {
            });

            expect(bus.listApis()).toEqual(['test_api']);
            expect(logger.info).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Registered API \'test_api\' (mode: poll)');
        });

        it('should throw if the API was already registered', (): void => {
            const bus = new Bus({ logger });

            bus.registerApi('test_api', () => {
            });

            expect(logger.info).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Registered API \'test_api\' (mode: poll)');

            const expectedError = 'API \'test_api\' already registered';

            expect(() => {
                bus.registerApi('test_api', () => {
                });
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });

        it('should allow to set API mode to \'push\'', (): void => {
            const bus = new Bus({ logger });

            bus.registerApi('testApi', () => {
            }, PollMode.Push);

            expect(bus.listApis()).toEqual(['testApi']);
            expect(logger.info).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Registered API \'testApi\' (mode: push)');
        });

        it('should throw if we pass an invalid API mode', (): void => {
            const bus = new Bus({ logger });

            const expectedError = 'API mode \'invalid\' is not a valid mode, must be one of \'poll\' or \'push\'';

            expect(() => {
                bus.registerApi('test_api', () => {
                    // @ts-ignore
                }, 'invalid');
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });
    });

    describe('removeClient', (): void => {
        it('should remove a registered client from the current list', (): void => {
            const bus = new Bus({ logger });

            bus.addClient({ id: 'test_client' } as unknown as Socket);
            expect(bus.listClients()).toHaveProperty('test_client');

            bus.removeClient('test_client');
            expect(bus.listClients()).not.toHaveProperty('test_client');

            expect(logger.info).toHaveBeenCalledTimes(2);
            expect(logger.info).toHaveBeenCalledWith('Client #test_client connected');
            expect(logger.info).toHaveBeenCalledWith('Client #test_client disconnected');
        });

        it('should cleanup subscription and remove timer if no clients left', (): void => {
            const bus = new Bus({ logger });

            bus.addClient({
                id: 'test_client',
                emit: jest.fn(),
            } as unknown as Socket);
            expect(bus.listClients()).toHaveProperty('test_client');

            bus.registerApi('test_api', () => ({
                test() {
                },
            }));
            expect(bus.listApis()).toEqual(['test_api']);

            bus.subscribe('test_client', { id: 'test_api.test' } as unknown as Subscription);

            const subscriptions = bus.listSubscriptions();
            expect(subscriptions['test_api.test'].timer).not.toBeUndefined();
            expect(subscriptions['test_api.test']).toHaveProperty('clients');
            expect(subscriptions['test_api.test'].clients).toEqual(['test_client']);

            bus.removeClient('test_client');
            expect(subscriptions['test_api.test'].timer).toBeUndefined();
            expect(subscriptions['test_api.test'].clients).toEqual([]);
        });
    });

    describe('subscribe', (): void => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should log an error if there is no existing client having given id', (): void => {
            const bus = new Bus({ logger });
            const apiMock = { fetch: jest.fn() };

            bus.registerApi('test_api', () => apiMock);
            bus.subscribe('test_client', generateSubscription('test_api.fetch'));

            expect(apiMock.fetch).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Unable to find a client with id \'test_client\'');
        });

        it('should throw and log an error if the request id is invalid', (): void => {
            const bus = new Bus({ logger });
            const apiMock = { fetch: jest.fn() };
            const client = { id: 'test_client' } as unknown as Socket;

            bus.registerApi('test_api', () => apiMock);
            bus.addClient(client);

            const expectedError = 'Invalid subscription id \'test_api\', should be something like \'api_id.method\'';

            expect(() => {
                bus.subscribe('test_client', generateSubscription('test_api'));
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });

        it('should throw and log an error if there is no existing api for given request id', (): void => {
            const bus = new Bus({ logger });
            const apiMock = { fetch: jest.fn() };
            const client = { id: 'test_client' } as unknown as Socket;

            bus.registerApi('test_api', () => apiMock);
            bus.addClient(client);

            const expectedError = 'Unable to find API matching id \'invalid_api\'';

            expect(() => {
                bus.subscribe('test_client', generateSubscription('invalid_api.invalid_method'));
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });

        it('should throw and log an error if the api method does not exists', (): void => {
            const bus = new Bus({ logger });
            const apiMock = { fetch: jest.fn() };
            const client = { id: 'test_client' } as unknown as Socket;

            bus.registerApi('test_api', () => apiMock);
            bus.addClient(client);

            const expectedError = 'Unable to find API method matching \'invalid_method\'';

            expect(() => {
                bus.subscribe('test_client', generateSubscription('test_api.invalid_method'));
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });

        it('should throw and log an error if the api method is not a function', (): void => {
            const bus = new Bus({ logger });
            const client = { id: 'test_client' } as unknown as Socket;

            bus.registerApi('test_api', () => ({ method: 'method' }));
            bus.addClient(client);

            const expectedError = 'API method \'test_api.method\' MUST be a function';

            expect(() => {
                bus.subscribe('test_client', generateSubscription('test_api.method'));
            }).toThrow(expectedError);

            expect(logger.error).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(expectedError);
        });

        it('should immediately call the api if there\'s no matching subscription', (): void => {
            const bus = new Bus({ logger });
            const apiMock = { fetch: jest.fn() };
            const clientMock = { id: 'test_client', emit: jest.fn() } as unknown as Socket;

            bus.registerApi('test_api', () => apiMock);
            bus.addClient(clientMock);
            bus.subscribe('test_client', generateSubscription('test_api.fetch', undefined, 'arg0'));

            expect(apiMock.fetch).toHaveBeenCalled();
            expect(apiMock.fetch).toHaveBeenCalledWith('arg0');
        });

        it('should create a timer if there\'s no matching subscription', (): void => {
            const apiData = { test: true };
            const apiMock = {
                fetch: jest.fn(() => ({
                    then: jest.fn((fn) => {
                        fn(apiData);
                    }),
                })),
            };
            const clientMock = { id: 'test_client', emit: jest.fn() } as unknown as Socket;
            const bus = new Bus({ logger });

            bus.registerApi('test_api', () => apiMock);
            bus.addClient(clientMock);
            bus.subscribe('test_client', generateSubscription('test_api.fetch'));

            expect(logger.error).not.toHaveBeenCalled();

            expect(setInterval).toHaveBeenCalledTimes(1);
            // @ts-ignore
            expect(setInterval.mock.calls[0][1]).toBe(15000);

            jest.runTimersToTime(15000);

            expect(logger.info).toHaveBeenCalledTimes(6);
            expect(logger.info).toHaveBeenCalledWith('Registered API \'test_api\' (mode: poll)');
            expect(logger.info).toHaveBeenCalledWith('Client #test_client connected');
            expect(logger.info).toHaveBeenCalledWith('Added subscription \'test_api.fetch\'');
            expect(logger.info).toHaveBeenCalledWith('Calling \'test_api.fetch\'');
            expect(logger.info).toHaveBeenCalledWith('Creating scheduler for subscription \'test_api.fetch\'');

            expect(apiMock.fetch).toHaveBeenCalledTimes(2);
        });

        it('should create a producer if there\'s no matching subscription and API mode is \'push\'', (): void => {
            const bus = new Bus({ logger });

            const pushMock = jest.fn();
            const clientMock = { id: 'test_client', emit: jest.fn() } as unknown as Socket;

            bus.registerApi('test_api', () => ({ push: pushMock }), PollMode.Push);
            bus.addClient(clientMock);
            bus.subscribe('test_client', generateSubscription('test_api.push', undefined, 'arg0'));

            expect(pushMock).toHaveBeenCalled();

            const subscriptions = bus.listSubscriptions();
            expect(subscriptions['test_api.push']).not.toBeUndefined();
            expect(subscriptions['test_api.push'].timer).toBeUndefined();

            expect(logger.info).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Creating producer for \'test_api.push\'');
        });

        it('should not add the same client id twice to the subscription client list', (): void => {
            const bus = new Bus({ logger });

            bus.registerApi('test_api', () => ({
                push: () => {
                },
            }), PollMode.Push);
            bus.addClient({
                id: 'test_client',
                // @ts-ignore
                emit() {
                },
            });
            bus.subscribe('test_client', generateSubscription('test_api.push'));

            let subscriptions = bus.listSubscriptions();
            expect(subscriptions['test_api.push']).not.toBeUndefined();
            expect(subscriptions['test_api.push'].clients).toEqual(['test_client']);

            bus.subscribe('test_client', generateSubscription('test_api.push'));

            subscriptions = bus.listSubscriptions();
            expect(subscriptions['test_api.push'].clients).toEqual(['test_client']);
        });
    });

    describe('unsubscribe', (): void => {
        it('should warn if the client does not exist', (): void => {
            const bus = new Bus({ logger });

            bus.unsubscribe('invalid', 'invalid');

            expect(logger.warn).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                'unable to unsubscribe from \'invalid\', client with id \'invalid\' does not exist',
            );
        });

        it('should warn if the subscription does not exist', (): void => {
            const bus = new Bus({ logger });

            bus.clients = { testClient: {} as unknown as Socket };
            bus.unsubscribe('testClient', 'invalid');

            expect(logger.warn).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                'unable to unsubscribe from \'invalid\', subscription does not exist',
            );
        });

        it('should remove client from subscription', (): void => {
            const bus = new Bus({ logger });

            bus.clients = { testClient: {} as unknown as Socket };
            bus.subscriptions = {
                testSubscription: {
                    clients: ['testClient', 'otherClient'],
                } as unknown as Subscription,
            };
            bus.unsubscribe('testClient', 'testSubscription');

            const subscriptions = bus.listSubscriptions();
            expect(subscriptions).toHaveProperty('testSubscription');
            expect(subscriptions.testSubscription).toEqual({
                clients: ['otherClient'],
            });
        });

        it('should remove subscription if no more client left', (): void => {
            const bus = new Bus({ logger });

            bus.clients = { testClient: {} as unknown as Socket };
            bus.subscriptions = {
                testSubscription: {
                    clients: ['testClient'],
                    timer: {} as unknown as NodeJS.Timer,
                } as unknown as Subscription,
            };

            bus.unsubscribe('testClient', 'testSubscription');

            const subscriptions = bus.listSubscriptions();
            expect(subscriptions).toEqual({});
        });
    });
});
