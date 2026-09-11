'use strict';
const { createWechatPlatform } = require('./platform/wechat');
const { mount } = require('./runtime');
mount(createWechatPlatform(wx, { requestAnimationFrame, cancelAnimationFrame }));
