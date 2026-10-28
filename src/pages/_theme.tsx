import getSystem from '@/utils/get-system'
const OS = getSystem()

// default theme setting
export const defaultTheme = {
  primary_color: '#16875A',
  secondary_color: '#448AC9',
  primary_text: '#17211D',
  secondary_text: '#64716B',
  info_color: '#16875A',
  error_color: '#FF3B30',
  warning_color: '#FF9500',
  success_color: '#06943D',
  background_color: '#F3F6F4',
  font_family: `-apple-system, BlinkMacSystemFont,"Microsoft YaHei UI", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji"${
    OS === 'windows' ? ', twemoji mozilla' : ''
  }`,
}

// dark mode
export const defaultDarkTheme = {
  ...defaultTheme,
  primary_color: '#4ADE9B',
  secondary_color: '#7CB8FF',
  primary_text: '#E9ECEF',
  background_color: '#0F1114',
  secondary_text: '#A3ACB6',
  info_color: '#4ADE9B',
  error_color: '#FF8A7A',
  warning_color: '#F5B54A',
  success_color: '#4ADE9B',
}
