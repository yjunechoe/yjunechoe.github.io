# Run {julia} chunks in knitr through JuliaConnectoR.
# Use in a post's setup chunk: source("../../_tools/julia.R")
# (posts/<slug>/ and drafts/<slug>/ are both two levels down)
# Julia uses the post folder's Project.toml if there is one.

Sys.setenv(JULIA_PROJECT = "@.")

knitr::knit_engines$set(julia = function(options) {
  code <- paste(options$code, collapse = "\n")
  run <- function() {
    # Evaluate in Main so variables persist across chunks. Return printed
    # output plus the value of the last expression, unless the code ends in `;`.
    JuliaConnectoR::juliaLet('
      mktemp() do path, io
        val = redirect_stdout(io) do
          include_string(Main, code)
        end
        flush(io)
        shown = endswith(rstrip(code), ";") || val === nothing ? "" :
          sprint(show, MIME"text/plain"(), val; context = :limit => true)
        String(rstrip(read(path, String) * shown))
      end', code = code)
  }
  out <- if (!isTRUE(options$eval)) {
    NULL
  } else if (isTRUE(options$error)) {
    # `#| error: true` shows the Julia error in the output instead of stopping
    tryCatch(run(), error = function(e) {
      msg <- sub("(?s).*Original Julia error message:\\s*", "", conditionMessage(e), perl = TRUE)
      paste("ERROR:", sub("^LoadError: ", "", trimws(msg)))
    })
  } else {
    run()
  }
  knitr::engine_output(options, options$code, out)
})
