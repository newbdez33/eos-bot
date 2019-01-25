require ('ansicolor').nice;
const config = require('config');
const { Api, JsonRpc, RpcError } = require('eosjs');
const JsSignatureProvider = require('eosjs/dist/eosjs-jssig').default;
const { TextEncoder, TextDecoder } = require('util');
const fetch = require('node-fetch');
const Telegraf = require('telegraf')
const Extra = require('telegraf/extra')
const session = require('telegraf/session')
const { reply } = Telegraf

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

const bot = new Telegraf(config.get('telegram.token'))

// // Register session middleware
bot.use(session())

// Register logger middleware
bot.use((ctx, next) => {
  const start = new Date()
  return next().then(() => {
    const ms = new Date() - start
    console.log('response time %sms', ms)
  })
})

// Login widget events
bot.on('connected_website', ({ reply }) => reply('Website connected'))
// Telegram passport events
bot.on('passport_data', ({ reply }) => reply('Telegram password connected'))

var accounts = config.accounts;
var pks = [];
for( var i=0; i< accounts.length; i++) {
  pks.push(accounts[i].pk);
}

var api = null;
try {
  const signatureProvider = new JsSignatureProvider(pks);
  const rpc = new JsonRpc('https://api.jeda.one', { fetch });
  api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
}catch(e) {
  console.log("Create eos instance failed. check your account and private keys in config/default.json.");
  return;
}



bot.start((ctx) => ctx.reply('Welcome!'))

//let's make these globaly at first.
var input_contract = null;
var input_action = null;
var input_data = null;
const example = `/eosio.token transfer '{"from":"##name##", "to":"noooooooooop", "quantity":"0.0001 EOS", "memo":"test"}'`;
bot.command((ctx) => {
  var msg = ctx.message.text
  console.log(msg);
  if ( msg == "/a" ) {
    ctx.reply(answers_accounts());
    return;
  }

  var match = msg.match(/^\/([a-z1-5\.]+)\ +([a-z1-5\.]+)\ +\'(\{.+?\})\'$/);
  if (match && match.length == 4) {
    var contract = match[1];
    var action = match[2];
    var data = match[3];

    try {
      data = data.replace()
      var json = JSON.parse(data);
    }catch(e) {
      console.log("data json failed:" + data);
      ctx.reply("Command data json format error, for example: \n" + example);
      return;
    }

    input_contract = contract;
    input_action = action;
    input_data = json;

    return ctx.reply("contract:" + contract + "\naction: " + action + "\ndata: " + data, Extra.HTML().markup((m) =>
    m.inlineKeyboard([
      m.callbackButton('Send', 'Send'),
    ])))
  }else {
    ctx.reply("Please enter command for example: \n" + example);
    return;
  }
  
})

bot.action('Send', (ctx, next) => {
  for( var i=0; i< accounts.length; i++) {
    let name = accounts[i].name;
    try {
      eos_contract(name, ctx);
    } catch(e) {
      console.log(e);
    }
  }
  //return ctx.reply('👍');
})

function replace_input_data(name) {
  var data = JSON.stringify(input_data);
  data = data.replace(/\#\#name\#\#/, name);
  return JSON.parse(data);
}

function eos_contract(name, ctx) {
  //console.log(input_data);
  replaced_data = replace_input_data(name);
  (async () => {
    try {
      const result = await api.transact({
        actions: [{
          account: input_contract,
          name: input_action,
          authorization: [{
            actor: name,
            permission: 'active',
          }],
          data: replaced_data,
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 30,
      });
      console.log(result);
      if ( result && result.transaction_id != undefined ) {
        let l = "https://www.eosx.io/tx/" + result.transaction_id;
        ctx.reply(l);
      }else {
        ctx.reply(result);
      }
    } catch(e) {
      console.log("eos_contract " + e);
    }
  })();
}

function answers_accounts() {
  var response = ""
  for( var i=0; i< accounts.length; i++) {
    var name = accounts[i].name
    response = response + name + "\n";
  }
  response += "--------\nTotal: " + accounts.length + " accounts";
  return response;
}

// Launch bot
bot.launch()
