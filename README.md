# NeuralHook
NeuralHook is a Uniswap v4 hook that dynamically adjusts pool fees based on AI market signals without
trusting any centralized oracle. The AI model runs inside a hardware enclave (TEE) on 0G's Sealed Inference
layer and produces a cryptographically signed output. The hook reads and verifies that signature on-chain
before acting. No admin key. No trusted middleman. Just a proof.
