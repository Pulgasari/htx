# scratch

```html
<htx-obj name='Udo' age='66' country='Germany' />
```

```html
<list>
  <str>cat</str>
  <str>dog</str>
  <str>bird</str>
</list>
```

```html
<list>
  <str 'cat'  />
  <str 'dog'  />
  <str 'bird' />
</list>
```

```html
<list type='str'>
  <'cat'/>
  <'dog'/>
  <'bird'/>
</list>
```

```html
<list type='str'>{['cat, 'dog', 'bird']}</list>
```

```html
<list type='str' items={['cat, 'dog', 'bird']} />
```

## ...

```javascript
// @aufbau/elements/htx
const lib = htx`
  <tmpl tag='btn'   is='aufbau-button' attr='label' />
  <tmpl tag='icon'  is='aufbau-icon'   attr='name'  />
  <tmpl tag='index' is='aufbau-index' />
`;
export default lib;
```

```javascript
// @aufbau/elements/htx
const lib = [
  htx`<tmpl tag='btn'   is='aufbau-button' attr='label' />`,
  htx`<tmpl tag='icon'  is='aufbau-icon'   attr='name'  />`,
  htx`<tmpl tag='index' is='aufbau-index' />`,
];
export default lib;
```


```html
<!-- @aufbau/elements/htx -->
<htx-export>
  <htx-template tag='btn'   is='aufbau-button' attr='label' />
  <htx-template tag='icon'  is='aufbau-icon'   attr='name' />
  <htx-template tag='index' is='aufbau-index' />
</htx-export>
```

```html
<htx>
  <htx-use src='https://esm.sh/jsr/@aufbau/elements/htx' />

  <icon 'bx:search' />
</htx>
```

```html
<htx>
  <htx-import as='elements' src='https://esm.sh/jsr/@aufbau/elements/htx' />
  <htx-use 'elements' />

  <icon 'bx:search' />
</htx>
```

