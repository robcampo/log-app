import './style.css';
import { App } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('No #app element');

new App(root);
