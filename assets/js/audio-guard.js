(function(){
  const global = typeof window !== 'undefined' ? window : null;
  if (!global) return;
  const BaseContext = global.AudioContext || global.webkitAudioContext;
  if (!BaseContext) return;

  const contexts = new Set();

  const resumeEvents = ['pointerdown', 'touchstart', 'keydown'];
  let resumeBound = false;

  function shouldDefer(error){
    if (!error) return false;
    const name = error.name || '';
    if (name === 'NotAllowedError' || name === 'InvalidStateError' || name === 'SecurityError') {
      return true;
    }
    if (name === 'DOMException') {
      const message = String(error.message || '').toLowerCase();
      if (!message) return true;
      if (message.includes('notallowederror') || message.includes('not allowed')) return true;
      if (message.includes('invalidstateerror') || message.includes('invalid state')) return true;
    }
    return false;
  }

  function resumeAll(){
    contexts.forEach(ctx => {
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
  }

  function bindResume(){
    if (resumeBound) return;
    resumeBound = true;
    const handler = () => {
      resumeAll();
    };
    resumeEvents.forEach(type => {
      document.addEventListener(type, handler, { passive: true });
    });
  }

  function wrapInstance(ctx){
    contexts.add(ctx);
    bindResume();

    const queue = [];
    const baseDecode = ctx.decodeAudioData.bind(ctx);

    function drainQueue(){
      if (!queue.length) return;
      const pending = queue.splice(0);
      pending.forEach(item => {
        const retryBuffer = item.buffer.slice(0);
        baseDecode(retryBuffer).then(result => {
          if (typeof item.success === 'function') {
            try { item.success(result); } catch (err) { /* ignore callback errors */ }
          }
          item.resolve(result);
        }).catch(err => {
          if (typeof item.failure === 'function') {
            try { item.failure(err); } catch (err2) { /* ignore callback errors */ }
          }
          item.reject(err);
        });
      });
    }

    ctx.decodeAudioData = function decodeAudioData(buffer, success, failure){
      const copyForDecode = buffer.slice(0);
      const copyForRetry = buffer.slice(0);
      return new Promise((resolve, reject) => {
        baseDecode(copyForDecode).then(result => {
          if (typeof success === 'function') {
            try { success(result); } catch (err) { /* ignore callback errors */ }
          }
          resolve(result);
        }).catch(err => {
          if (!shouldDefer(err)) {
            if (typeof failure === 'function') {
              try { failure(err); } catch (err2) { /* ignore callback errors */ }
            }
            reject(err);
            return;
          }
          queue.push({
            buffer: copyForRetry,
            success,
            failure,
            resolve,
            reject
          });
          resumeAll();
        });
      });
    };

    if (typeof ctx.addEventListener === 'function') {
      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'running') {
          drainQueue();
        } else if (ctx.state === 'closed') {
          contexts.delete(ctx);
          queue.length = 0;
        }
      });
    }
  }

  function createPatched(Context){
    function PatchedAudioContext(...args){
      const instance = new Context(...args);
      wrapInstance(instance);
      return instance;
    }
    PatchedAudioContext.prototype = Context.prototype;
    Object.setPrototypeOf(PatchedAudioContext, Context);
    return PatchedAudioContext;
  }

  const Patched = createPatched(BaseContext);
  global.AudioContext = Patched;
  if ('webkitAudioContext' in global) {
    global.webkitAudioContext = Patched;
  }
})();
