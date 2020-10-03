from bs4 import BeautifulSoup
import re

with open('docs/index.html', 'r') as file:
    index = file.read()
    
soup = BeautifulSoup(index, 'html.parser')
# print(soup.prettify())



articles = soup.find("div", "posts-list").find_all("h2")
articles = [str(article.contents) for article in articles]

tag_metadata = soup.find_all("script", "post-metadata")
tags = [re.findall("[\\w| |-]+", tag.string) for tag in tag_metadata]


n_articles = len(articles)

# Add tags

for i, metadata in enumerate(soup.find_all("div", "metadata")):
  dt_tags = soup.new_tag("div")
  dt_tags["class"] = "dt-tags"
  for tag in tags[i-1]:
    if tag != "categories":
      new_tag = soup.new_tag("div")
      new_tag.append(tag)
      new_tag["class"] = "dt-tag"
      dt_tags.append(new_tag)
  metadata.append(dt_tags)


# ALL ARTICLES category

all_articles = soup.new_tag("li")
all_articles.append(soup.new_tag("a", href = ""))
all_articles.a.string = "ALL ARTICLES"

category_count = soup.new_tag("span")
category_count["class"] = "category-count"
category_count.string = " (" + str(len(articles)) + ")"

all_articles.append(category_count)

soup.find("div", "sidebar-section categories").ul.insert(0, all_articles)


# Modify script

with open('dev_script.txt', 'r') as file:
    dev_script = file.read()

soup.find_all("script")[12].string = dev_script


# Save

with open("docs/index.html", "w", encoding='utf-8') as file:
  file.write(str(soup))





### sitemap

