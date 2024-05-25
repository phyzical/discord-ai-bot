import { install } from 'source-map-support';
import { init } from './build/Manager.js';

install();
init(import.meta.url);
