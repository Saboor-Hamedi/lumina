@ai-sdk_deepseek.js?v=b3ff86cf:1648  POST https://api.deepseek.com/chat/completions net::ERR_CONNECTION_TIMED_OUT
postToApi @ @ai-sdk_deepseek.js?v=b3ff86cf:1648
postJsonToApi @ @ai-sdk_deepseek.js?v=b3ff86cf:1623
doStream @ @ai-sdk_deepseek.js?v=b3ff86cf:2317
await in doStream
fn @ ai.js?v=b3ff86cf:12048
await in fn
(anonymous) @ ai.js?v=b3ff86cf:7203
with @ ai.js?v=b3ff86cf:4450
with @ ai.js?v=b3ff86cf:4500
(anonymous) @ ai.js?v=b3ff86cf:7203
startActiveSpan @ ai.js?v=b3ff86cf:7131
recordSpan @ ai.js?v=b3ff86cf:7197
await in recordSpan
(anonymous) @ ai.js?v=b3ff86cf:12006
_retryWithExponentialBackoff @ ai.js?v=b3ff86cf:7508
(anonymous) @ ai.js?v=b3ff86cf:7495
streamStep @ ai.js?v=b3ff86cf:12005
await in streamStep
fn @ ai.js?v=b3ff86cf:12417
await in fn
(anonymous) @ ai.js?v=b3ff86cf:7203
with @ ai.js?v=b3ff86cf:4450
with @ ai.js?v=b3ff86cf:4500
(anonymous) @ ai.js?v=b3ff86cf:7203
startActiveSpan @ ai.js?v=b3ff86cf:7131
recordSpan @ ai.js?v=b3ff86cf:7197
ai.js?v=b3ff86cf:11235 TypeError: Failed to fetch
    at postToApi (@ai-sdk_deepseek.js?v=b3ff86cf:1648:28)
    at postJsonToApi (@ai-sdk_deepseek.js?v=b3ff86cf:1623:7)
    at DeepSeekChatLanguageModel.doStream (@ai-sdk_deepseek.js?v=b3ff86cf:2317:56)
    at async fn (ai.js?v=b3ff86cf:12048:27)
    at async ai.js?v=b3ff86cf:7203:24
    at async _retryWithExponentialBackoff (ai.js?v=b3ff86cf:7508:12)
    at async streamStep (ai.js?v=b3ff86cf:12005:17)
    at async fn (ai.js?v=b3ff86cf:12417:9)
    at async ai.js?v=b3ff86cf:7203:24
onError @ ai.js?v=b3ff86cf:11235
transform @ ai.js?v=b3ff86cf:11440
useAIStore.js:1030 Stream error: TypeError: Failed to fetch
    at postToApi (@ai-sdk_deepseek.js?v=b3ff86cf:1648:28)
    at postJsonToApi (@ai-sdk_deepseek.js?v=b3ff86cf:1623:7)
    at DeepSeekChatLanguageModel.doStream (@ai-sdk_deepseek.js?v=b3ff86cf:2317:56)
    at async fn (ai.js?v=b3ff86cf:12048:27)
    at async ai.js?v=b3ff86cf:7203:24
    at async _retryWithExponentialBackoff (ai.js?v=b3ff86cf:7508:12)
    at async streamStep (ai.js?v=b3ff86cf:12005:17)
    at async fn (ai.js?v=b3ff86cf:12417:9)
    at async ai.js?v=b3ff86cf:7203:24