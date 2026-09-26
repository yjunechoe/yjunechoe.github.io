// Sample of the {palmerpenguins} data,
// filtered to maximize x-spread for pedagogical purposes
// ---{r}
// data <- palmerpenguins::penguins %>%
//  na.omit() %>%
//  filter(species != "Chinstrap") %>%
//  arrange(body_mass_g) %>%
//  filter(row_number() %% 6 == 0) %>%
//  slice(1:40) %>%
//  select(predictor = body_mass_g, observed = bill_length_mm)
// ---
// Model fitted with `mod <- lm(observed ~ predictor, data)`
// ---{r}
// data <- broom::augment(mod, data, interval = "confidence") %>%
//   select(1:5) %>%
//   janitor::clean_names() %>%
//   mutate(residual = observed - fitted, residual_z = scale(residual)[,1]) %>%
//   modify(~ round(.x, 2)) %>%
//   arrange(residual)
// 

const data = [{"predictor":3725,"observed":35,"fitted":39.61,"residual":-4.61,"residual_z":-2.2},{"predictor":3050,"observed":32.1,"fitted":36.06,"residual":-3.96,"residual_z":-1.89},{"predictor":4450,"observed":39.6,"fitted":43.42,"residual":-3.82,"residual_z":-1.82},{"predictor":3700,"observed":36.6,"fitted":39.48,"residual":-2.88,"residual_z":-1.37},{"predictor":3775,"observed":37.3,"fitted":39.87,"residual":-2.57,"residual_z":-1.22},{"predictor":4900,"observed":43.6,"fitted":45.78,"residual":-2.18,"residual_z":-1.04},{"predictor":5200,"observed":45.2,"fitted":47.36,"residual":-2.16,"residual_z":-1.03},{"predictor":5500,"observed":46.8,"fitted":48.94,"residual":-2.14,"residual_z":-1.02},{"predictor":4400,"observed":41.3,"fitted":43.16,"residual":-1.86,"residual_z":-0.89},{"predictor":5300,"observed":46.2,"fitted":47.89,"residual":-1.69,"residual_z":-0.8},{"predictor":3600,"observed":37.6,"fitted":38.95,"residual":-1.35,"residual_z":-0.64},{"predictor":3300,"observed":36.2,"fitted":37.37,"residual":-1.17,"residual_z":-0.56},{"predictor":4650,"observed":43.5,"fitted":44.47,"residual":-0.97,"residual_z":-0.46},{"predictor":4600,"observed":43.4,"fitted":44.21,"residual":-0.81,"residual_z":-0.39},{"predictor":3500,"observed":37.7,"fitted":38.42,"residual":-0.72,"residual_z":-0.34},{"predictor":3150,"observed":36.2,"fitted":36.58,"residual":-0.38,"residual_z":-0.18},{"predictor":3350,"observed":37.3,"fitted":37.64,"residual":-0.34,"residual_z":-0.16},{"predictor":4275,"observed":42.2,"fitted":42.5,"residual":-0.3,"residual_z":-0.14},{"predictor":5400,"observed":48.4,"fitted":48.41,"residual":-0.01,"residual_z":-0},{"predictor":4750,"observed":45.2,"fitted":45,"residual":0.2,"residual_z":0.1},{"predictor":3900,"observed":40.9,"fitted":40.53,"residual":0.37,"residual_z":0.18},{"predictor":4150,"observed":42.3,"fitted":41.84,"residual":0.46,"residual_z":0.22},{"predictor":3900,"observed":41.1,"fitted":40.53,"residual":0.57,"residual_z":0.27},{"predictor":3800,"observed":40.6,"fitted":40,"residual":0.6,"residual_z":0.29},{"predictor":4050,"observed":42,"fitted":41.32,"residual":0.68,"residual_z":0.32},{"predictor":3550,"observed":39.6,"fitted":38.69,"residual":0.91,"residual_z":0.43},{"predictor":4975,"observed":47.2,"fitted":46.18,"residual":1.02,"residual_z":0.49},{"predictor":4850,"observed":46.6,"fitted":45.52,"residual":1.08,"residual_z":0.51},{"predictor":4300,"observed":43.8,"fitted":42.63,"residual":1.17,"residual_z":0.56},{"predictor":5550,"observed":50.5,"fitted":49.2,"residual":1.3,"residual_z":0.62},{"predictor":5100,"observed":48.2,"fitted":46.84,"residual":1.36,"residual_z":0.65},{"predictor":4700,"observed":46.4,"fitted":44.73,"residual":1.67,"residual_z":0.8},{"predictor":3950,"observed":42.7,"fitted":40.79,"residual":1.91,"residual_z":0.91},{"predictor":3450,"observed":40.2,"fitted":38.16,"residual":2.04,"residual_z":0.97},{"predictor":2925,"observed":37.9,"fitted":35.4,"residual":2.5,"residual_z":1.19},{"predictor":4550,"observed":46.5,"fitted":43.94,"residual":2.56,"residual_z":1.22},{"predictor":3200,"observed":39.7,"fitted":36.85,"residual":2.85,"residual_z":1.36},{"predictor":3425,"observed":41.1,"fitted":38.03,"residual":3.07,"residual_z":1.46},{"predictor":4200,"observed":45.5,"fitted":42.1,"residual":3.4,"residual_z":1.62},{"predictor":5000,"observed":50.5,"fitted":46.31,"residual":4.19,"residual_z":2}]

const model = {
  params: {intercept: 20.02, slope: 0.00526},
  R2: 0.775
}
model.predict = function(x) {return model.params.intercept + model.params.slope * x}