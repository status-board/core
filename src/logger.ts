import signale, { Signale } from 'signale';

export { Signale as Logger };

signale.config({
    displayFilename: true,
    displayTimestamp: true,
    displayDate: false,
});

export default signale;
