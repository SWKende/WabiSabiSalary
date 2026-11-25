export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/expense-statistics/index',
  ],
  window: {
    navigationStyle: 'custom',
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f5f0e8',
    navigationBarTitleText: '记账',
    navigationBarTextStyle: 'black',
  }
})
