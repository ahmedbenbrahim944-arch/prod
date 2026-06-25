import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbsentsComponent } from './absents.component';

describe('AbsentsComponent', () => {
  let component: AbsentsComponent;
  let fixture: ComponentFixture<AbsentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbsentsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AbsentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
