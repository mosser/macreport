# Fonts

Noto Sans Regular and Bold, version 2.015, from
`notofonts/latin-greek-cyrillic` (release `NotoSans-v2.015`, unhinted TTF),
under the SIL Open Font License 1.1 (`OFL.txt`).

Cut down with fontTools 4.60.1 to the Latin, Greek and Cyrillic alphabets,
combining marks and common punctuation, without hinting:

```sh
pyftsubset NotoSans-<Weight>.ttf \
  --unicodes="U+0020-007E,U+00A0-024F,U+0250-02FF,U+0300-036F,U+0370-03FF,U+0400-052F,U+1E00-1EFF,U+1F00-1FFF,U+2000-206F,U+20A0-20C0,U+2100-214F,U+2190-2193,U+2212,U+2C60-2C7F,U+2DE0-2DFF,U+A640-A69F,U+A720-A7FF,U+FFFD" \
  --layout-features='kern,liga,ccmp,locl,mark,mkmk' --no-hinting --name-IDs='*' \
  --output-file=NotoSans-<Weight>.ttf
```
