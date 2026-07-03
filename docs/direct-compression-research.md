# Direct Compression Research

## Question

Can MDZ reduce provider-billed tokens through lossless compression of prompts
and responses?

## Current Hypothesis

Raw compression does not reduce billed model tokens unless decompression happens
before model tokenization or outside the model context.

## Boundaries To Test

### Model Context Boundary

Test whether compressed strings such as gzip+base64 reduce token count compared
with original text.

Expected result:

- compressed text usually tokenizes poorly,
- model cannot reliably use it without decompression instructions,
- semantic task quality drops.

### Provider File/Artifact Boundary

Test whether providers or platforms support uploaded artifacts that can be
referenced cheaply and expanded selectively.

Expected result:

- platform-specific,
- promising where file search, retrieval, or artifact handles exist.

### Agent Runtime Boundary

Test whether MDZ can store original content locally and send handles plus
summaries into model context.

Expected result:

- universally promising,
- requires agent/tool cooperation to expand handles.

### UI Boundary

Test whether final answers can be stored locally while compact summaries remain
in the active conversation.

Expected result:

- promising for output-token reduction,
- requires platform or UI integration for best experience.

### Network Boundary

Test whether compression between client and provider saves bandwidth.

Expected result:

- may save bytes,
- does not reduce billed tokens unless provider decompresses before tokenization.

## Experiments

1. Compare token counts:
   - original text,
   - minified text,
   - gzip+base64,
   - zstd+base64,
   - dictionary/macro form,
   - handle+summary form.

2. Compare task quality:
   - answer from original,
   - answer from compressed text,
   - answer from handle+summary with expansion tool.

3. Compare output strategies:
   - normal final answer,
   - terse final answer,
   - full answer stored with short visible summary,
   - structured result with expandable sections.

## Decision Rule

MDZ should only use a compression strategy automatically when it improves token
usage and does not materially degrade task quality in benchmark scenarios.
