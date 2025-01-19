import { useState, useEffect, useRef} from 'react'
import './App.css'
import Login from './Login/Login'
import Console from './Console/Console'



function App() {
  const [user, setUser] = useState(null)
  const [err, setErr] = useState(null)
  const [ws, setWs] = useState(null)
  const [game, setGame] = useState(null)
  const [account, setAccount] = useState(null)
  const gameref = useRef(game)
  const accountref = useRef(account)
  const [addr, setAddr] = useState("")
  
  //incase order fill comes before order confirm
  let tmp_fill = {}

  useEffect(() => {
    if (user) {
        let newws = new WebSocket(addr, [user.uid]);
        newws.onopen = () => console.log("ws opened");
        newws.onclose = () => console.log("ws closed");
        newws.onmessage = function(e) {
          console.log(e)
          let [type, body] = Object.entries(JSON.parse(e.data))[0]
          switch (type) {
            case "GameState":
              setGame(body)
              break;
            case "AccountInfo":
              setAccount(body)
              break;
            case "TradeOccurredMessage": {
              let {amount, symbol, resting_side, price, time} = body
              let newgame = {...gameref.current}
              newgame[symbol][
                resting_side == "Buy" ?
                'buy_side_limit_levels' :
                'sell_side_limit_levels'
              ][price].total_volume -= amount;
              newgame[symbol].price_history.push([time, price, amount])
              setGame(newgame)
              break;
            }
            case "NewRestingOrderMessage":
              let {side, amount, symbol, price} = body
                let newgame = {...gameref.current}
                newgame[symbol][
                  side == "Buy" ?
                  'buy_side_limit_levels' :
                  'sell_side_limit_levels'
                ][price].total_volume += amount;
                setGame(newgame)
              break;
            case "OrderPlaceErrorMessage":
              console.log("error: ", body)
              break;
            case "OrderConfirmMessage": {
              body = body.order_info
              let newaccount = {...accountref.current}
              let {price, order_type, amount, symbol, order_id} = body;
              
              if (order_type == "Buy") {
                newaccount.net_cents_balance -= price * amount
              }
              else {
                newaccount.net_asset_balances[body.symbol] -= amount
              }

              if (order_id in tmp_fill) {
                amount -= tmp_fill[body.order_id];
                if (order_type == "Buy") {
                  newaccount.cents_balance -= price * tmp_fill[body.order_id]
                  newaccount.asset_balances[symbol] += tmp_fill[body.order_id]
                  newaccount.net_asset_balances[symbol] += tmp_fill[body.order_id]
                } else {
                  newaccount.cents_balance += price * tmp_fill[body.order_id]
                  newaccount.net_cents_balance += price * tmp_fill[body.order_id]
                  newaccount.asset_balances[symbol] -= tmp_fill[body.order_id]
                }
                delete tmp_fill[body.order_id];
              }

              if (amount > 0) {
                body.amount = amount
                newaccount.active_orders.push(body)
              }

              setAccount(newaccount)
              break;
            }
            case "OrderFillMessage": {
              let {order_id, amount_filled, price} = body
              let newaccount = {...accountref.current}
              let idx = newaccount.active_orders.findIndex(
                (e) => e.order_id == order_id
              )
              if (idx == -1) {
                if (order_id in tmp_fill) {
                  tmp_fill[order_id] += amount_filled
                } else {
                  tmp_fill[order_id] = amount_filled
                }
                break;
              }
              let {order_type, symbol, amount} = newaccount.active_orders[idx]
              if (order_type == "Buy") {
                newaccount.cents_balance -= price * amount
                newaccount.asset_balances[symbol] += amount
                newaccount.net_asset_balances[symbol] += amount
              } else {
                newaccount.cents_balance += price * amount
                newaccount.net_cents_balance += price * amount
                newaccount.asset_balances[symbol] -= amount
              }
              if (amount == amount_filled) newaccount.active_orders.splice(idx, 1);
              else newaccount.active_orders[idx].amount -= amount_filled;
              setAccount(newaccount)
              break; 
            }
            case "CancelConfirmMessage": {
              body = body.order_info
              let newaccount = {...accountref.current}
              let idx = newaccount.active_orders.findIndex(
                (e) => e.order_id == body.order_id
              )
              let {order_type, symbol, amount} = newaccount.active_orders[idx]
              if (order_type == "Buy") {
                newaccount.net_cents_balance += price * amount
              } else {
                newaccount.net_asset_balances[symbol] += amount
              }
              newaccount.active_orders.splice(idx, 1)
              setAccount(newaccount)
              break; 
            }
            case "CancelErrorMessage":
              console.log("error: ", body)
              break;
            case "CancelOccurredMessage": {
              let newgame = {...gameref.current}
              let {symbol, price, side, amount} = body
              newgame[symbol][
                side == "Buy" ?
                'buy_side_limit_levels' :
                'sell_side_limit_levels'
              ][price].total_volume -= amount
              setGame(newgame)
              break;
            }
              
          }
        };
    
        setWs(newws);
      }
    }, [user])

    useEffect(() => {gameref.current = game}, [game])
    useEffect(() => {accountref.current = account}, [account])

  if (ws) { return <Console ws={ws} user={user} game={game} account={account} /> }
  return <Login user={user} setUser={setUser} setWs={setWs} err={err} setErr={setErr} addr={addr} setAddr={setAddr}/>
  //eventually add an end screen
}

export default App
